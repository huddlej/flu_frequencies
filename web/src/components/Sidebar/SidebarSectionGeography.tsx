import { isEmpty, sortBy } from 'lodash-es'
import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRecoilState } from 'recoil'
import styled from 'styled-components'
import { Form } from 'reactstrap'
import { useTranslationSafe } from 'src/helpers/useTranslationSafe'
import { Pathogen, usePathogen, useRegionsDataQuery } from 'src/io/getData'
import { fuzzySearchObj } from 'src/helpers/fuzzySearch'
import { continentAtom, countryAtom, geographyEnableAllAtom, geographySearchTermAtom } from 'src/state/geography.state'
import { CheckboxIndeterminateWithText, CheckboxWithIcon } from 'src/components/Common/Checkbox'
import { transliterate } from 'transliteration'

const GeoIconCountry = dynamic(() => import('src/components/Common/GeoIconCountry').then((m) => m.GeoIconCountry))
const GeoIconContinent = dynamic(() => import('src/components/Common/GeoIconContinent').then((m) => m.GeoIconContinent))

const Container = styled.div`
  display: flex;
  flex-direction: column;
`

export interface SidebarSectionGeographyProps {
  pathogenName: string
}

export function SidebarSectionGeography({ pathogenName }: SidebarSectionGeographyProps) {
  const { t } = useTranslationSafe()
  const pathogen = usePathogen(pathogenName)
  const { countries, regions } = useRegionsDataQuery(pathogen.name)
  const [searchTerm] = useRecoilState(geographySearchTermAtom)

  const checkboxes = useMemo(() => {
    const regionsTranslated = regions.map((region) => {
      const translated = t(region)
      const transliterated = transliterate(translated)
      return { region, translated, transliterated }
    })
    const countriesTranslated = countries.map((country) => {
      const translated = t(country)
      const transliterated = transliterate(translated)
      return { country, translated, transliterated }
    })

    const scored = [
      ...fuzzySearchObj(regionsTranslated, ['region', 'translated', 'transliterated'], searchTerm).map(
        ({ item: { region }, score }) => ({
          component: <ContinentCheckbox key={region} continent={region} pathogenName={pathogenName} />,
          score,
        }),
      ),
      ...fuzzySearchObj(countriesTranslated, ['country', 'translated', 'transliterated'], searchTerm).map(
        ({ item: { country }, score }) => ({
          component: <CountryCheckbox key={country} country={country} pathogenName={pathogenName} />,
          score,
        }),
      ),
    ]

    const checkboxes = sortBy(scored, ({ score }) => score).map(({ component }) => component)

    if (isEmpty(searchTerm)) {
      checkboxes.unshift(<GeographySelectAll key="GeographySelectAll" pathogen={pathogen} />)
    }

    return checkboxes
  }, [countries, pathogen, pathogenName, regions, searchTerm, t])

  return (
    <Container>
      <Form>{checkboxes}</Form>
    </Container>
  )
}

export interface GeographySelectAllProps {
  pathogen: Pathogen
}

export function GeographySelectAll({ pathogen }: GeographySelectAllProps) {
  const { t } = useTranslationSafe()
  const [isAllEnabled, setIsAllEnabled] = useRecoilState(geographyEnableAllAtom(pathogen.name))
  return (
    <CheckboxIndeterminateWithText
      label={t('Select all')}
      title={t('Select all')}
      state={isAllEnabled}
      onChange={setIsAllEnabled}
    />
  )
}

export interface CountryCheckboxProps {
  pathogenName: string
  country: string
}

export function CountryCheckbox({ pathogenName, country }: CountryCheckboxProps) {
  const { t } = useTranslationSafe()
  const pathogen = usePathogen(pathogenName)
  const [countryEnabled, setCountryEnabled] = useRecoilState(countryAtom({ pathogen: pathogen.name, country }))
  const Icon = useMemo(() => <GeoIconCountry country={country} />, [country])
  const text = useMemo(() => t(country), [country, t])
  return (
    <CheckboxWithIcon label={text} title={text} icon={Icon} checked={countryEnabled} setChecked={setCountryEnabled} />
  )
}

export interface ContinentCheckboxProps {
  pathogenName: string
  continent: string
}

export function ContinentCheckbox({ pathogenName, continent }: ContinentCheckboxProps) {
  const { t } = useTranslationSafe()
  const pathogen = usePathogen(pathogenName)
  const [continentEnabled, setContinentEnabled] = useRecoilState(continentAtom({ pathogen: pathogen.name, continent }))
  const Icon = useMemo(() => <GeoIconContinent continent={continent} />, [continent])
  const text = useMemo(() => t(continent), [continent, t])
  return (
    <CheckboxWithIcon
      title={text}
      label={text}
      icon={Icon}
      checked={continentEnabled}
      setChecked={setContinentEnabled}
    />
  )
}
