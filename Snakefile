regions = config["regions"]
min_date = config["min_date"]


rule europe:
    input:
        [
            "plots/h3n2/Region_Europe.png",
            "plots/h1n1pdm/Region_Europe.png",
            "plots/h3n2/Country_Europe_Spain.png",
            "plots/h3n2/Country_Europe_Netherlands.png",
            "plots/h3n2/Country_Europe_United-Kingdom.png",
            "plots/h3n2/Country_Europe_France.png",
            "plots/h1n1pdm/Country_Europe_Spain.png",
            "plots/h1n1pdm/Country_Europe_Netherlands.png",
            "plots/h1n1pdm/Country_Europe_United-Kingdom.png",
            "plots/h1n1pdm/Country_Europe_France.png",
            "plots/h3n2/region_mut-HA1:E50.png",
            "plots/h3n2/region_mut-HA1:I140.png",
            "plots/h3n2/region-clades.png",
            "plots/h1n1pdm/region-clades.png",
            "plots/vic/region-clades.png",
        ],


rule download_sequences:
    output:
        sequences="data/{lineage}/raw_ha.fasta",
    params:
        s3_path="s3://nextstrain-data-private/files/workflows/seasonal-flu/{lineage}/ha/raw_sequences.fasta.xz",
    shell:
        """
        aws s3 cp {params.s3_path} - | xz -c -d > {output.sequences}
        """


rule parse:
    """
    Parsing fasta into sequences and metadata
    TODO: Download results directly once https://github.com/nextstrain/seasonal-flu/issues/107 is resolved
    """
    input:
        sequences="data/{lineage}/raw_ha.fasta",
    output:
        sequences="data/{lineage}/ha.fasta",
        metadata="data/{lineage}/metadata.tsv",
    params:
        fasta_fields=config["fasta_fields"],
        prettify_fields=config["prettify_fields"],
    shell:
        """
        augur parse \
            --sequences {input.sequences} \
            --output-sequences {output.sequences} \
            --output-metadata {output.metadata} \
            --fields {params.fasta_fields} \
            --prettify-fields {params.prettify_fields}
        """


rule get_nextclade_dataset:
    output:
        "nextclade/{lineage}/reference.fasta",
    threads: 4
    shell:
        """
        nextclade dataset get -n flu_{wildcards.lineage}_ha --output-dir nextclade/{wildcards.lineage}
        """


rule run_nextclade:
    input:
        sequences="data/{lineage}/ha.fasta",
        reference="nextclade/{lineage}/reference.fasta",
    output:
        "data/{lineage}/nextclade.tsv",
    threads: 4
    shell:
        """
        nextclade run -j {threads} -D nextclade/{wildcards.lineage} {input.sequences} --quiet --output-tsv {output}
        """


rule combined_with_metadata:
    input:
        nextclade="data/{lineage}/nextclade.tsv",
        metadata="data/{lineage}/metadata.tsv",
    output:
        "data/{lineage}/combined.tsv",
    params:
        col=lambda w: "clade" if w.lineage == "vic" else "short_clade",
    run:
        import pandas as pd

        clades = pd.read_csv(input[0], sep="\t", index_col="seqName")[params.col]
        aaSubstitutions = pd.read_csv(input[0], sep="\t", index_col="seqName")[
            "aaSubstitutions"
        ]

        metadata = pd.read_csv(input[1], sep="\t", index_col="strain")
        metadata["clade"] = clades
        metadata["aaSubstitutions"] = aaSubstitutions

        metadata.to_csv(output[0], sep="\t", index=False)


rule estimate_region_frequencies:
    input:
        "data/{lineage}/combined.tsv",
    output:
        output_csv="results/{lineage}/region-frequencies.csv",
    params:
        min_date=min_date,
    shell:
        """
        python scripts/fit_single_frequencies.py --metadata {input} --geo-categories region --frequency-category clade \
                --min-date {params.min_date} --days 14 --output-csv {output.output_csv}
        """


rule estimate_region_mutation_frequencies:
    input:
        "data/{lineage}/combined.tsv",
    output:
        output_csv="results/{lineage}/mutation_{mutation}-frequencies.csv",
    params:
        min_date=min_date,
    shell:
        """
        python scripts/fit_single_frequencies.py --metadata {input} --geo-categories region --frequency-category mutation-{wildcards.mutation} \
                --min-date {params.min_date} --days 14 --output-csv {output.output_csv}
        """


rule estimate_region_country_frequencies:
    input:
        "data/{lineage}/combined.tsv",
    output:
        output_csv="results/{lineage}/region-country-frequencies.csv",
    params:
        min_date=min_date,
    shell:
        """
        python scripts/fit_hierarchical_frequencies.py --metadata {input} \
                --geo-categories region country --frequency-category clade \
                --min-date {params.min_date} --days 14 --output-csv {output.output_csv}
        """


rule plot_regions:
    input:
        freqs="results/{lineage}/region-frequencies.csv",
    output:
        plot="plots/{lineage}/Region_{region}.png",
    params:
        max_freq=0.1,
    shell:
        """
        python scripts/plot_region.py --frequencies {input.freqs} --region {wildcards.region:q} \
                --max-freq {params.max_freq} --output {output.plot}
        """


rule plot_mutations:
    input:
        freqs="results/{lineage}/mutation_{mutation}-frequencies.csv",
    output:
        plot="plots/{lineage}/mutation_{region}-{mutation}.png",
    params:
        max_freq=0.05,
    shell:
        """
        python scripts/plot_region.py --frequencies {input.freqs} --region {wildcards.region:q} \
                --max-freq {params.max_freq} --output {output.plot}
        """


rule plot_country:
    input:
        freqs="results/{lineage}/region-country-frequencies.csv",
    output:
        plot="plots/{lineage}/Country_{region}_{country}.png",
    params:
        max_freq=0.1,
    shell:
        """
        python scripts/plot_country.py --frequencies {input.freqs} --region {wildcards.region:q} --country {wildcards.country:q} \
                --max-freq {params.max_freq} --output {output.plot}
        """


rule multi_region_plot_clades:
    input:
        freqs="results/{lineage}/region-frequencies.csv",
    output:
        plot="plots/{lineage}/region-clades.png",
    params:
        regions=[
            "Africa",
            "Europe",
            "North_America",
            "South_America",
            "South_Asia",
            "Southeast_Asia",
            "West_Asia",
            "Oceania",
        ],
        max_freq=0.2,
    shell:
        """
        python3 scripts/plot_multi-region.py --frequencies {input.freqs}  \
                --regions {params.regions}  --max-freq {params.max_freq} \
                --output {output.plot}
        """


rule multi_region_plot_mutation:
    input:
        freqs="results/{lineage}/mutation_{mutation}-frequencies.csv",
    output:
        plot="plots/{lineage}/region_mut-{mutation}.png",
    params:
        regions=[
            "Africa",
            "Europe",
            "North_America",
            "South_America",
            "South_Asia",
            "Southeast_Asia",
            "West_Asia",
            "Oceania",
        ],
        max_freq=0.2,
    shell:
        """
        python3 scripts/plot_multi-region.py --frequencies {input.freqs} --regions {params.regions}  --max-freq {params.max_freq} --output {output.plot}
        """


#        clades = ['1a.1', '2a.1', '2a.1a', '2a.1b', '2a.3a',  '2a.3a.1','2a.3b', '2b'],


rule clean:
    shell:
        "rm -rf data/ results/ plots/"
