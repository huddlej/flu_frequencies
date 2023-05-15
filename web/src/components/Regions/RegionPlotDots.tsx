import React from 'react'
import { useTheme } from 'styled-components'

const AREA_FACTOR = 0.6
const CIRCLE_LINEWIDTH = 2

// Line plot dot component which displays a bubble in proportion to frequency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CustomizedDot(props: any) {
  const theme = useTheme()
  const y0 = theme.plot.margin.top

  const {
    cx,
    cy,
    stroke,
    name,
    payload: { counts, totals },
    height,
  } = props

  if (totals[name] === 0) {
    // variant has not been observed in this region
    return null
  }

  const freq = counts[name] / totals[name]

  // FIXME: fails if value = 1
  // const cy2 = (cy-y0)*(1-freq)/(1-value) + y0;  // empirical val mapped to plot region
  const cy2 = height * (1 - freq) + y0

  const rad = 1 + AREA_FACTOR * Math.sqrt(counts[name])

  return (
    <>
      <circle cx={cx} cy={cy2} stroke={stroke} strokeWidth={CIRCLE_LINEWIDTH} fill="#ffffff88" r={rad} />
      <line x1={cx} y1={cy} x2={cx} y2={cy < cy2 ? cy2 - rad : cy2 + rad} stroke={stroke} strokeWidth={1} />
    </>
  )
}

// Line plot active (on mouse hover) dot component which displays either a bubble in proportion to frequency or a confidence line
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CustomizedActiveDot(props: any) {
  const theme = useTheme()
  const y0 = theme.plot.margin.top

  const {
    cx,
    cy,
    fill,
    name,
    payload: { counts, ranges, totals },
    value,
    shouldShowRanges,
  } = props

  if (shouldShowRanges) {
    // confidence intervals already displayed as shaded areas, fill circles instead
    if (totals[name] === 0) {
      // no counts, no meaningful empirical frequencies can be displayed
      return null
    }

    const freq = counts[name] / totals[name]
    // map freq from (0,1) to plot region
    const cy2 = value === 1 ? y0 : ((cy - y0) * (1 - freq)) / (1 - value) + y0

    return (
      <circle
        cx={cx}
        cy={cy2}
        stroke={fill}
        strokeWidth={CIRCLE_LINEWIDTH}
        fill={fill}
        r={1 + AREA_FACTOR * Math.sqrt(counts[name])}
      />
    )
  }

  // display confidence interval as vertical line segment
  const r1 = ranges[name][0]
  const r2 = ranges[name][1]

  return (
    <line
      x1={cx}
      y1={((cy - y0) * (1 - r2)) / (1 - value) + y0}
      x2={cx}
      y2={((cy - y0) * (1 - r1)) / (1 - value) + y0}
      stroke={fill}
      strokeWidth={5}
    />
  )
}
