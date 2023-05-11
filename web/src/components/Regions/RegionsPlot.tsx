import React, { useCallback, useMemo, useState, FunctionComponent } from 'react'
import { get, isArray, max, min } from 'lodash-es'
import { DateTime } from 'luxon'
import { useRecoilValue } from 'recoil'
import { useResizeDetector } from 'react-resize-detector'
import styled, { useTheme } from 'styled-components'
import { Area, CartesianGrid, ComposedChart, Line, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import {
  formatDateHumanely,
  formatDateWeekly,
  formatProportion,
  timestampToDate,
  ymdToTimestamp,
} from 'src/helpers/format'
import { calculateTicks } from 'src/helpers/adjustTicks'
import { getCountryColor, getCountryStrokeDashArray, Pathogen, useRegionDataQuery } from 'src/io/getData'
import { shouldShowRangesOnRegionsPlotAtom } from 'src/state/settings.state'
import { variantsAtom } from 'src/state/variants.state'
import { RegionsPlotTooltip } from 'src/components/Regions/RegionsPlotTooltip'
import { DateSlider } from 'src/components/Common/DateSlider'
import { localeAtom } from 'src/state/locale.state'

const allowEscapeViewBox = { x: false, y: true }
const tooltipStyle = { zIndex: 1000, outline: 'none' }

interface LinePlotProps<T> {
  data: T[]
  minDate: DateTime
  maxDate: DateTime
  width: number
  height: number
  pathogen: Pathogen
  countryName: string
}

function RegionsPlotImpl<T>({ width, height, data, minDate, maxDate, pathogen, countryName }: LinePlotProps<T>) {
  const theme = useTheme()
  const locale = useRecoilValue(localeAtom)
  const shouldShowRanges = useRecoilValue(shouldShowRangesOnRegionsPlotAtom)
  const variants = useRecoilValue(variantsAtom(pathogen.name))  // name, color and lineStyle
  const {
    variantsData: { variantsStyles },
  } = useRegionDataQuery(pathogen.name, countryName)

  const { adjustedTicks, domainX, domainY } = useMemo(
    () => calculateTicks(minDate, maxDate, width ?? 0, theme.plot.tickWidthMin),
    [maxDate, minDate, theme.plot.tickWidthMin, width],
  )

  const { lines, ranges } = useMemo(() => {
    // add points with area in proportion to variant count
    const CustomizedDot: FunctionComponent<any> = (props: any) => {
      //console.log(props);
      const { cx, cy, stroke, fill, name, payload, value } = props;
      let ev = payload.counts[name] / payload.totals[name],  // empirical value (freq)
          y0 = 32,  // vertical offset (top margin) 
          cy2 = (cy-y0)*(1-ev)/(1-value) + y0,  // empirical val mapped to plot region
          rad = 1 + 0.6 * Math.sqrt(payload.counts[name])
      return(
        <>
          <circle cx={cx} cy={cy2} stroke={stroke} strokeWidth={2} 
                  fill="#ffffff88" r={rad}
          />
          <line x1={cx} y1={cy} x2={cx} y2={(cy<cy2) ? (cy2-rad) : (cy2+rad)}
                stroke={stroke} strokeWidth={1}
          />
        </>
      )
    };

    const CustomizedActiveDot: FunctionComponent<any> = (props: any) => {
      //console.log(props);
      const { cx, cy, fill, name, payload, value } = props;
      if (shouldShowRanges) {
        return(
          <circle cx={cx} cy={cy} stroke={fill} strokeWidth={2} fill={fill} 
                  r={1 + 0.6 * Math.sqrt(payload.counts[name])}
          />
        );
      } 
      else {
        let r1 = payload.ranges[name][0],
            r2 = payload.ranges[name][1],
            y0 = 32;  // FIXME: top margin - need to pass from parent
        return(
          <line x1={cx} y1={(cy-y0)*(1-r2)/(1-value) + y0}
                x2={cx} y2={(cy-y0)*(1-r1)/(1-value) + y0}
                stroke={fill} strokeWidth={5}
          /> 
        );
      }
    };

    const lines = variants
      .map(
        ({ name, enabled }) =>
          enabled && (
            <Line
              key={`line-${name}`}
              type="linear"
              name={name}  // variant name
              dataKey={(d) => get(d.avgs, name)} // eslint-disable-line react-perf/jsx-no-new-function-as-prop
              stroke={getCountryColor(variantsStyles, name)}
              strokeWidth={theme.plot.line.strokeWidth}
              strokeDasharray={getCountryStrokeDashArray(variantsStyles, name)}
              dot={<CustomizedDot />}
              activeDot={<CustomizedActiveDot name={name} />}
              isAnimationActive={false}
              animationDuration={300}
            />
          ),
      )
      .filter(Boolean)

      // confidence intervals as shaded polygons
    const ranges = variants
      .map(
        ({ name, enabled }) =>
          enabled && (
            <Area
              key={`area-${name}`}
              name={name}
              dataKey={(d) => get(d.ranges, name)} // eslint-disable-line react-perf/jsx-no-new-function-as-prop
              stroke="none"
              fill={getCountryColor(variantsStyles, name)}
              fillOpacity={0.1}
              isAnimationActive={false}
              animationDuration={300}
              activeDot={false}
              display={!shouldShowRanges ? 'none' : undefined}
            />
          ),
      )
      .filter(Boolean)

    return { lines, ranges }
  }, [shouldShowRanges, theme.plot.line.strokeWidth, variants, variantsStyles])  // dependencies

  const metadata = useMemo(() => ({ pathogenName: pathogen.name, countryName }), [countryName, pathogen.name])

  return (
    <ComposedChart width={width} height={height} margin={theme.plot.margin} data={data}>
      <XAxis
        dataKey="timestamp"
        type="number"
        tickFormatter={formatDateHumanely(locale)}
        domain={domainX}
        ticks={adjustedTicks}
        tick={theme.plot.tickStyle}
        tickMargin={theme.plot.tickMargin?.x}
        style={theme.plot.axes.x}
        allowDataOverflow
      />
      <YAxis
        type="number"
        tickFormatter={formatProportion(locale)}
        domain={domainY}
        tick={theme.plot.tickStyle}
        tickMargin={theme.plot.tickMargin?.y}
        style={theme.plot.axes.y}
        allowDataOverflow
      />
      <RechartsTooltip
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        content={RegionsPlotTooltip}
        metadata={metadata}
        isAnimationActive={false}
        allowEscapeViewBox={allowEscapeViewBox}
        offset={50}
        wrapperStyle={tooltipStyle}
      />
      <CartesianGrid stroke={theme.plot.cartesianGrid.stroke} />
      {lines}
      {ranges}
    </ComposedChart>
  )
}

export interface RegionsPlotProps {
  pathogen: Pathogen
  countryName: string
}

export function RegionsPlot({ pathogen, countryName }: RegionsPlotProps) {
  const { regionData } = useRegionDataQuery(pathogen.name, countryName)

  const { minTimestamp, maxTimestamp, initialTimestampRange, marks } = useMemo(() => {
    const timestamps = regionData.values.map(({ date }) => ymdToTimestamp(date))
    const minTimestamp = min(timestamps) ?? 0
    const maxTimestamp = max(timestamps) ?? 0
    const initialTimestampRange = [minTimestamp, maxTimestamp]
    const marks = Object.fromEntries(timestamps.map((timestamp) => [timestamp, formatDateWeekly(timestamp)]))
    return { minTimestamp, maxTimestamp, initialTimestampRange, marks }
  }, [regionData.values])

  const [dateRange, setDateRange] = useState(initialTimestampRange)

  const onDateRangeChange = useCallback((range: number | number[]) => {
    if (isArray(range)) {
      setDateRange(range)
    }
  }, [])

  const { data, minDate, maxDate } = useMemo(() => {
    // subset data (avgs, counts, date, ranges, totals) to date range
    const data = regionData.values
      .filter(({ date }) => {
        const ts = ymdToTimestamp(date)
        return ts <= dateRange[1] && ts >= dateRange[0]
      })
      .map(({ date, ...rest }) => ({ ...rest, timestamp: ymdToTimestamp(date) }))

    const minDate = timestampToDate(dateRange[0])
    const maxDate = timestampToDate(dateRange[1])

    return { data, minDate, maxDate }
  }, [dateRange, regionData.values])

  const {
    width = 0,
    height = 0,
    ref: resizeRef,
  } = useResizeDetector({
    handleWidth: true,
    handleHeight: true,
    refreshRate: 300,
    refreshMode: 'debounce',
  })

  return (
    <>
      <PlotWrapper ref={resizeRef}>
        <RegionsPlotImpl
          data={data}
          width={width}
          height={height}
          minDate={minDate}
          maxDate={maxDate}
          pathogen={pathogen}
          countryName={countryName}
        />
      </PlotWrapper>

      <DateSlider
        minTimestamp={minTimestamp}
        maxTimestamp={maxTimestamp}
        initialTimestampRange={initialTimestampRange}
        marks={marks}
        onDateRangeChange={onDateRangeChange}
      />
    </>
  )
}

const PlotWrapper = styled.div`
  flex: 1;
`
