import BoxContainer from '@/components/container/boxed'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import { POLICY_DOCUMENTS } from './data'

/**
 * Public /privacy page: the Privacy Policy, Terms & Conditions and Cookie Policy
 * of `.omp/Prayer365_Policies_Revised_EN.pdf` on one scrollable document.
 *
 * Server component — the copy is resolved for the cookie locale on the server, so
 * the only client interaction is the browser's own anchor scrolling. Section
 * numbering mirrors the PDF; `/terms` and `/cookies` deep-link into the anchors
 * defined here.
 */
export default function ContentsSitePrivacy({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <main className="bg-[#F5F7FF] text-[#191C1E]">
      <BoxContainer sectionClassName="!py-12 md:!py-16">
        <div className="mx-auto max-w-[760px]">
          <div className="w-fit rounded-full bg-[#E6EDFB] px-3.5 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#0B4497]">
              {t('policiesEyebrow')}
            </span>
          </div>

          <h1 className="mt-4 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
            {t('policiesTitle')}
          </h1>
          <p className="mt-3 text-[13px] font-medium text-[#5C6370]">{t('policiesUpdated')}</p>

          <nav
            aria-label={t('policiesNavLabel')}
            className="mt-6 flex flex-wrap gap-2 border-b border-[#E6EDFB] pb-6"
          >
            {POLICY_DOCUMENTS.map((document) => (
              <a
                className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-[#0B4497] ring-1 ring-inset ring-[#E6EDFB] transition-colors hover:bg-[#E6EDFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                href={`#${document.id}`}
                key={document.id}
              >
                {t(document.identifierKey)}
              </a>
            ))}
          </nav>

          {POLICY_DOCUMENTS.map((document) => (
            <section
              aria-labelledby={`${document.id}-heading`}
              className="scroll-mt-8 pt-12"
              id={document.id}
              key={document.id}
            >
              <h2
                className="font-font_heading text-xl font-semibold text-primary-900 md:text-2xl"
                id={`${document.id}-heading`}
              >
                {t(document.identifierKey)}
              </h2>

              {document.introKeys.map((key) => (
                <p className="mt-4 text-[15px] leading-relaxed text-neutral-600" key={key}>
                  {t(key)}
                </p>
              ))}

              {document.sections.map((section) => (
                <div className="mt-8" key={section.titleKey}>
                  <h3 className="font-font_heading text-lg font-semibold text-primary-900">
                    {t(section.titleKey)}
                  </h3>

                  {section.paragraphKeys.map((key) => (
                    <p className="mt-3 text-[15px] leading-relaxed text-neutral-600" key={key}>
                      {t(key)}
                    </p>
                  ))}

                  {(section.subsectionKeys ?? []).map((subsection) => (
                    <div className="mt-6" key={subsection.titleKey}>
                      <h4 className="text-base font-semibold text-primary-900">
                        {t(subsection.titleKey)}
                      </h4>
                      {subsection.paragraphKeys.map((key) => (
                        <p className="mt-3 text-[15px] leading-relaxed text-neutral-600" key={key}>
                          {t(key)}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}

          <p className="mt-12 border-t border-[#E6EDFB] pt-6 text-[13px] text-[#5C6370]">
            {t('policiesContact')}
          </p>
        </div>
      </BoxContainer>
    </main>
  )
}
