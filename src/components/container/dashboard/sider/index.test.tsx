import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SideBar from '.'

describe('dashboard sidebar collapse control', () => {
  it('keeps an expanded submenu closed when its heading is clicked', () => {
    const { container } = renderWithProviders(<SideBar />)
    const churchSection = container.querySelector(
      '.ant-menu-submenu > .ant-menu-submenu-title[data-menu-id$="-churches"]',
    )

    expect(churchSection?.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(churchSection!)

    expect(churchSection?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('.ant-menu-submenu-open')).toHaveLength(2)
  })

  it('collapses and expands the sidebar while keeping section controls available', () => {
    const { container } = renderWithProviders(<SideBar />)

    expect(screen.getAllByText('Churches').length).toBeGreaterThan(0)
    expect(container.querySelector('.ant-layout-sider-collapsed')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(container.querySelector('.ant-layout-sider-collapsed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()

    const collapsedSections = container.querySelectorAll(
      '.ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title',
    )
    expect(collapsedSections).toHaveLength(3)
    expect(collapsedSections[0].querySelector('.layout-icon')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))

    expect(container.querySelector('.ant-layout-sider-collapsed')).toBeNull()
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy()
    expect(container.querySelectorAll('.ant-menu-submenu-open')).toHaveLength(3)
  })
})
