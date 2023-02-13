import pandas as  pd
from datetime import datetime
import numpy as np

def zero_one_clamp(x):
    return max(0,min(1,x))

def parse_dates(x):
    try:
        return datetime.strptime(x, "%Y-%m-%d")
    except:
        return None

def to_day_count(x, start_date):
    try:
        return x.toordinal()-start_date
    except:
        #print(x)
        return -1

def day_count_to_date(x, start_date):
    return datetime.fromordinal(start_date + x)

def load_and_aggregate(data, geo_categories, freq_category, min_date="2021-01-01", bin_size=7):
    if type(data)==str:
        d = pd.read_csv(data, sep='\t')
    else:
        d=data

    d["datetime"] = d.date.apply(parse_dates)
    d = d.loc[d.datetime.apply(lambda x:x is not None)]
    start_date = datetime.strptime(min_date, "%Y-%m-%d").toordinal()

    d["day_count"] = d.datetime.apply(lambda x: to_day_count(x, start_date))
    d  = d.loc[d["day_count"]>=0]
    d["time_bin"] = d.day_count//bin_size

    totals = d.groupby(by=geo_categories + ["time_bin"]).count()["day_count"].to_dict()

    fcats = d[freq_category].unique()
    counts = {}
    for fcat in fcats:
        counts[fcat] = d.loc[d[freq_category]==fcat].groupby(by=geo_categories + ["time_bin"]).count()["day_count"].to_dict()

    timebins = {int(x): day_count_to_date(x*bin_size, start_date) for x in sorted(d.time_bin.unique())}

    return d, totals, counts, timebins

def fit_single_category(totals, counts, time_bins, stiffness=0.3, pc=3, nstd = 2):

    values, column, row = [], [], []
    b = []
    for ti, t in enumerate(time_bins):
        if t==time_bins[0]:
            diag = stiffness
            values.append(-stiffness)
            row.append(ti)
            column.append(ti+1)
        elif t==time_bins[-1]:
            diag = stiffness
            values.append(-stiffness)
            row.append(ti)
            column.append(ti-1)
        else:
            diag = 2*stiffness
            values.append(-stiffness)
            row.append(ti)
            column.append(ti+1)
            values.append(-stiffness)
            row.append(ti)
            column.append(ti-1)

        k = counts.get(t, 0)
        n = totals.get(t, 0)
        pre_fac = n**2/(k + pc)/(n - k + pc)
        diag += n*pre_fac
        values.append(diag)
        row.append(ti)
        column.append(ti)
        b.append(k*pre_fac)

    from scipy.sparse import csr_matrix
    from scipy.sparse.linalg import spsolve
    from numpy.linalg import inv
    A = csr_matrix((values, (row, column)), shape=(len(b), len(b)))
    sol = spsolve(A,b)
    confidence = np.sqrt(np.diag(inv(A.todense())))

    return {t:{'val': sol[ti],
               'upper': min(1.0, sol[ti] + nstd*confidence[ti]),
               'lower': max(0.0, sol[ti] - nstd*confidence[ti])} for ti,t in enumerate(time_bins)}, A



if __name__=='__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", type=str, help="filename with metadata")
    parser.add_argument("--frequency-category", type=str, help="field to use for frequency categories")
    parser.add_argument("--geo-categories", nargs='+', type=str, help="field to use for geographic categories")
    parser.add_argument("--days", default=7, type=int, help="number of days in one time bin")
    parser.add_argument("--min-date", type=str, help="date to start frequency calculation")
    parser.add_argument("--output-json", type=str, help="file for json output")

    args = parser.parse_args()
    stiffness = 5000/args.days

    d = pd.read_csv(args.metadata, sep='\t')
    if args.frequency_category.startswith('mutation-'):
        mutation = args.frequency_category.split('-')[-1]
        def extract_mut(muts):
            if type(muts)==str:
                a = [y for y in muts.split(',') if y.startswith(mutation)]
                return a[0] if len(a) else 'WT'
            else:
                return 'WT'
        d["mutation"] = d.aaSubstitutions.apply(extract_mut)

        print(d.mutation.value_counts())
        freq_cat = "mutation"
    else:
        freq_cat = args.frequency_category

    data, totals, counts, time_bins = load_and_aggregate(d, args.geo_categories, freq_cat,
                                                         bin_size=args.days, min_date=args.min_date)


    dates = [time_bins[k] for k in time_bins]
    geo_cats = set([k[:-1] for k in totals])
    import matplotlib.pyplot as plt
    output_data = {"dates": {t:v.strftime('%Y-%m-%d') for t,v in time_bins.items()}}
    for geo_cat in geo_cats:
        frequencies = {}
        sub_counts = {}
        sub_totals = {k[-1]:v for k,v in totals.items() if tuple(k[:-1])==geo_cat}
        for fcat in counts.keys():
            sub_counts[fcat] = {k[-1]:v for k,v in counts[fcat].items() if tuple(k[:-1])==geo_cat}
            if sum(sub_counts[fcat].values())>10:
                frequencies[fcat],A = fit_single_category(sub_totals, sub_counts[fcat],
                                        sorted(time_bins.keys()), stiffness=stiffness)


        # fig = plt.figure()
        # for ci, fcat in enumerate(sorted(frequencies.keys())):
        #     plt.plot(dates, [sub_counts[fcat].get(t, 0)/sub_totals.get(t,0) if sub_totals.get(t,0) else np.nan for t in time_bins], 'o', c=f"C{ci}")
        #     plt.plot(dates, [frequencies[fcat][t]['val'] for t in time_bins], c=f"C{ci}", label=fcat)
        #     plt.fill_between(dates,
        #                     [frequencies[fcat][t]['lower'] for t in time_bins],
        #                     [frequencies[fcat][t]['upper'] for t in time_bins], color=f"C{ci}", alpha=0.2)
        # fig.autofmt_xdate()
        # plt.legend(loc=2)
        # plt.savefig(args.output_mask.format(cat='-'.join([x.replace(' ', '_') for x in geo_cat])))
        output_data[','.join(geo_cat)] = {"counts": sub_counts, "totals": sub_totals, "frequencies":frequencies}

    import json
    with open(args.output_json, 'w') as fh:
        json.dump(output_data, fh)


