import React from 'react'
import { isSidebarSettingsCollapsedAtom } from 'src/state/settings.state'
import { useTranslationSafe } from 'src/helpers/useTranslationSafe'
import { SidebarSectionGeography } from 'src/components/Sidebar/SidebarSectionGeography'
import { Sidebar, SidebarSection, SidebarSectionCollapsible } from 'src/components/Sidebar/SidebarCard'
import { VariantsPlotSettings } from './VariantsPlotSettings'

export function VariantsSidebar() {
  const { t } = useTranslationSafe()
  return (
    <Sidebar>
      <SidebarSection header={t('Geography')}>
        <SidebarSectionGeography />
      </SidebarSection>
      <SidebarSectionCollapsible header={t('Settings')} recoilState={isSidebarSettingsCollapsedAtom}>
        <VariantsPlotSettings />
      </SidebarSectionCollapsible>
    </Sidebar>
  )
}
