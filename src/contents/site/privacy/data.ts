import { SiteMessageKey } from '@/i18n/messages'

/**
 * Structure of /privacy, taken from `.omp/Prayer365_Policies_Revised_EN.pdf`.
 *
 * The text lives in `src/i18n/policies/*` as `policies*` keys; this module only
 * fixes the order, the numbering and the in-page anchors. Section numbers match
 * the PDF's own numbering, so the rendered page can be diffed against the source
 * document one section at a time.
 */
export type PolicySubsection = {
  titleKey: SiteMessageKey
  paragraphKeys: SiteMessageKey[]
}

export type PolicySection = {
  titleKey: SiteMessageKey
  paragraphKeys: SiteMessageKey[]
  subsectionKeys?: PolicySubsection[]
}

export type PolicyDocumentId = 'privacy' | 'terms' | 'cookies'

export type PolicyDocument = {
  /** In-page anchor; `/terms` and `/cookies` redirect to these. */
  id: PolicyDocumentId
  identifierKey: SiteMessageKey
  introKeys: SiteMessageKey[]
  sections: PolicySection[]
}

export const POLICY_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'privacy',
    identifierKey: 'policiesPrivacyIdentifier',
    introKeys: ['policiesPrivacyIntro1', 'policiesPrivacyIntro2'],
    sections: [
      {
        titleKey: 'policiesPrivacySection1Title',
        paragraphKeys: [],
        subsectionKeys: [
          {
            titleKey: 'policiesPrivacySection1Sub1Title',
            paragraphKeys: ['policiesPrivacySection1Sub1Paragraph1'],
          },
          {
            titleKey: 'policiesPrivacySection1Sub2Title',
            paragraphKeys: ['policiesPrivacySection1Sub2Paragraph1'],
          },
          {
            titleKey: 'policiesPrivacySection1Sub3Title',
            paragraphKeys: [
              'policiesPrivacySection1Sub3Paragraph1',
              'policiesPrivacySection1Sub3Paragraph2',
            ],
          },
          {
            titleKey: 'policiesPrivacySection1Sub4Title',
            paragraphKeys: [
              'policiesPrivacySection1Sub4Paragraph1',
              'policiesPrivacySection1Sub4Paragraph2',
            ],
          },
          {
            titleKey: 'policiesPrivacySection1Sub5Title',
            paragraphKeys: [
              'policiesPrivacySection1Sub5Paragraph1',
              'policiesPrivacySection1Sub5Paragraph2',
            ],
          },
          {
            titleKey: 'policiesPrivacySection1Sub6Title',
            paragraphKeys: ['policiesPrivacySection1Sub6Paragraph1'],
          },
          {
            titleKey: 'policiesPrivacySection1Sub7Title',
            paragraphKeys: ['policiesPrivacySection1Sub7Paragraph1'],
          },
          {
            titleKey: 'policiesPrivacySection1Sub8Title',
            paragraphKeys: [
              'policiesPrivacySection1Sub8Paragraph1',
              'policiesPrivacySection1Sub8Paragraph2',
            ],
          },
          {
            titleKey: 'policiesPrivacySection1Sub9Title',
            paragraphKeys: ['policiesPrivacySection1Sub9Paragraph1'],
          },
        ],
      },
      {
        titleKey: 'policiesPrivacySection2Title',
        paragraphKeys: [
          'policiesPrivacySection2Paragraph1',
          'policiesPrivacySection2Paragraph2',
          'policiesPrivacySection2Paragraph3',
        ],
      },
      {
        titleKey: 'policiesPrivacySection3Title',
        paragraphKeys: [
          'policiesPrivacySection3Paragraph1',
          'policiesPrivacySection3Paragraph2',
          'policiesPrivacySection3Paragraph3',
          'policiesPrivacySection3Paragraph4',
          'policiesPrivacySection3Paragraph5',
          'policiesPrivacySection3Paragraph6',
          'policiesPrivacySection3Paragraph7',
          'policiesPrivacySection3Paragraph8',
        ],
      },
      {
        titleKey: 'policiesPrivacySection4Title',
        paragraphKeys: [
          'policiesPrivacySection4Paragraph1',
          'policiesPrivacySection4Paragraph2',
          'policiesPrivacySection4Paragraph3',
          'policiesPrivacySection4Paragraph4',
          'policiesPrivacySection4Paragraph5',
        ],
      },
      {
        titleKey: 'policiesPrivacySection5Title',
        paragraphKeys: [
          'policiesPrivacySection5Paragraph1',
          'policiesPrivacySection5Paragraph2',
          'policiesPrivacySection5Paragraph3',
        ],
      },
      {
        titleKey: 'policiesPrivacySection6Title',
        paragraphKeys: [
          'policiesPrivacySection6Paragraph1',
          'policiesPrivacySection6Paragraph2',
          'policiesPrivacySection6Paragraph3',
          'policiesPrivacySection6Paragraph4',
        ],
      },
      {
        titleKey: 'policiesPrivacySection7Title',
        paragraphKeys: ['policiesPrivacySection7Paragraph1', 'policiesPrivacySection7Paragraph2'],
      },
      {
        titleKey: 'policiesPrivacySection8Title',
        paragraphKeys: ['policiesPrivacySection8Paragraph1', 'policiesPrivacySection8Paragraph2'],
        subsectionKeys: [
          {
            titleKey: 'policiesPrivacySection8Sub1Title',
            paragraphKeys: ['policiesPrivacySection8Sub1Paragraph1'],
          },
        ],
      },
      {
        titleKey: 'policiesPrivacySection9Title',
        paragraphKeys: ['policiesPrivacySection9Paragraph1', 'policiesPrivacySection9Paragraph2'],
      },
      {
        titleKey: 'policiesPrivacySection10Title',
        paragraphKeys: [
          'policiesPrivacySection10Paragraph1',
          'policiesPrivacySection10Paragraph2',
          'policiesPrivacySection10Paragraph3',
          'policiesPrivacySection10Paragraph4',
        ],
      },
      {
        titleKey: 'policiesPrivacySection11Title',
        paragraphKeys: [
          'policiesPrivacySection11Paragraph1',
          'policiesPrivacySection11Paragraph2',
          'policiesPrivacySection11Paragraph3',
          'policiesPrivacySection11Paragraph4',
          'policiesPrivacySection11Paragraph5',
        ],
      },
      {
        titleKey: 'policiesPrivacySection12Title',
        paragraphKeys: [
          'policiesPrivacySection12Paragraph1',
          'policiesPrivacySection12Paragraph2',
          'policiesPrivacySection12Paragraph3',
        ],
      },
      {
        titleKey: 'policiesPrivacySection13Title',
        paragraphKeys: ['policiesPrivacySection13Paragraph1', 'policiesPrivacySection13Paragraph2'],
      },
      {
        titleKey: 'policiesPrivacySection14Title',
        paragraphKeys: ['policiesPrivacySection14Paragraph1'],
      },
      {
        titleKey: 'policiesPrivacySection15Title',
        paragraphKeys: ['policiesPrivacySection15Paragraph1'],
      },
    ],
  },
  {
    id: 'terms',
    identifierKey: 'policiesTermsIdentifier',
    introKeys: ['policiesTermsIntro1', 'policiesTermsIntro2', 'policiesTermsIntro3'],
    sections: [
      {
        titleKey: 'policiesTermsSection1Title',
        paragraphKeys: [
          'policiesTermsSection1Paragraph1',
          'policiesTermsSection1Paragraph2',
          'policiesTermsSection1Paragraph3',
          'policiesTermsSection1Paragraph4',
          'policiesTermsSection1Paragraph5',
          'policiesTermsSection1Paragraph6',
        ],
      },
      {
        titleKey: 'policiesTermsSection2Title',
        paragraphKeys: ['policiesTermsSection2Paragraph1', 'policiesTermsSection2Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection3Title',
        paragraphKeys: [
          'policiesTermsSection3Paragraph1',
          'policiesTermsSection3Paragraph2',
          'policiesTermsSection3Paragraph3',
        ],
      },
      {
        titleKey: 'policiesTermsSection4Title',
        paragraphKeys: [
          'policiesTermsSection4Paragraph1',
          'policiesTermsSection4Paragraph2',
          'policiesTermsSection4Paragraph3',
        ],
      },
      {
        titleKey: 'policiesTermsSection5Title',
        paragraphKeys: [
          'policiesTermsSection5Paragraph1',
          'policiesTermsSection5Paragraph2',
          'policiesTermsSection5Paragraph3',
          'policiesTermsSection5Paragraph4',
        ],
      },
      {
        titleKey: 'policiesTermsSection6Title',
        paragraphKeys: [
          'policiesTermsSection6Paragraph1',
          'policiesTermsSection6Paragraph2',
          'policiesTermsSection6Paragraph3',
          'policiesTermsSection6Paragraph4',
          'policiesTermsSection6Paragraph5',
        ],
      },
      {
        titleKey: 'policiesTermsSection7Title',
        paragraphKeys: [
          'policiesTermsSection7Paragraph1',
          'policiesTermsSection7Paragraph2',
          'policiesTermsSection7Paragraph3',
          'policiesTermsSection7Paragraph4',
        ],
      },
      {
        titleKey: 'policiesTermsSection8Title',
        paragraphKeys: [
          'policiesTermsSection8Paragraph1',
          'policiesTermsSection8Paragraph2',
          'policiesTermsSection8Paragraph3',
          'policiesTermsSection8Paragraph4',
          'policiesTermsSection8Paragraph5',
          'policiesTermsSection8Paragraph6',
          'policiesTermsSection8Paragraph7',
        ],
      },
      {
        titleKey: 'policiesTermsSection9Title',
        paragraphKeys: [
          'policiesTermsSection9Paragraph1',
          'policiesTermsSection9Paragraph2',
          'policiesTermsSection9Paragraph3',
          'policiesTermsSection9Paragraph4',
        ],
      },
      {
        titleKey: 'policiesTermsSection10Title',
        paragraphKeys: [
          'policiesTermsSection10Paragraph1',
          'policiesTermsSection10Paragraph2',
          'policiesTermsSection10Paragraph3',
        ],
      },
      {
        titleKey: 'policiesTermsSection11Title',
        paragraphKeys: [
          'policiesTermsSection11Paragraph1',
          'policiesTermsSection11Paragraph2',
          'policiesTermsSection11Paragraph3',
        ],
      },
      {
        titleKey: 'policiesTermsSection12Title',
        paragraphKeys: ['policiesTermsSection12Paragraph1', 'policiesTermsSection12Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection13Title',
        paragraphKeys: ['policiesTermsSection13Paragraph1', 'policiesTermsSection13Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection14Title',
        paragraphKeys: ['policiesTermsSection14Paragraph1', 'policiesTermsSection14Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection15Title',
        paragraphKeys: ['policiesTermsSection15Paragraph1', 'policiesTermsSection15Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection16Title',
        paragraphKeys: [
          'policiesTermsSection16Paragraph1',
          'policiesTermsSection16Paragraph2',
          'policiesTermsSection16Paragraph3',
          'policiesTermsSection16Paragraph4',
        ],
      },
      {
        titleKey: 'policiesTermsSection17Title',
        paragraphKeys: [
          'policiesTermsSection17Paragraph1',
          'policiesTermsSection17Paragraph2',
          'policiesTermsSection17Paragraph3',
        ],
      },
      {
        titleKey: 'policiesTermsSection18Title',
        paragraphKeys: ['policiesTermsSection18Paragraph1'],
      },
      {
        titleKey: 'policiesTermsSection19Title',
        paragraphKeys: ['policiesTermsSection19Paragraph1', 'policiesTermsSection19Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection20Title',
        paragraphKeys: ['policiesTermsSection20Paragraph1', 'policiesTermsSection20Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection21Title',
        paragraphKeys: ['policiesTermsSection21Paragraph1', 'policiesTermsSection21Paragraph2'],
      },
      {
        titleKey: 'policiesTermsSection22Title',
        paragraphKeys: ['policiesTermsSection22Paragraph1'],
      },
    ],
  },
  {
    id: 'cookies',
    identifierKey: 'policiesCookieIdentifier',
    introKeys: [],
    sections: [
      {
        titleKey: 'policiesCookieSection1Title',
        paragraphKeys: ['policiesCookieSection1Paragraph1'],
      },
      {
        titleKey: 'policiesCookieSection2Title',
        paragraphKeys: ['policiesCookieSection2Paragraph1'],
      },
      {
        titleKey: 'policiesCookieSection3Title',
        paragraphKeys: ['policiesCookieSection3Paragraph1'],
      },
      {
        titleKey: 'policiesCookieSection4Title',
        paragraphKeys: ['policiesCookieSection4Paragraph1'],
      },
      {
        titleKey: 'policiesCookieSection5Title',
        paragraphKeys: [
          'policiesCookieSection5Paragraph1',
          'policiesCookieSection5Paragraph2',
          'policiesCookieSection5Paragraph3',
        ],
      },
      {
        titleKey: 'policiesCookieSection6Title',
        paragraphKeys: ['policiesCookieSection6Paragraph1', 'policiesCookieSection6Paragraph2'],
      },
    ],
  },
]

/** Every key the page renders, in order — used by the key-parity test. */
export const POLICY_MESSAGE_KEYS: SiteMessageKey[] = [
  'policiesTitle',
  'policiesEyebrow',
  'policiesUpdated',
  'policiesNavLabel',
  'policiesNavPrivacy',
  'policiesNavTerms',
  'policiesNavCookies',
  'policiesContact',
  ...POLICY_DOCUMENTS.flatMap((document) => [
    document.identifierKey,
    ...document.introKeys,
    ...document.sections.flatMap((section) => [
      section.titleKey,
      ...section.paragraphKeys,
      ...(section.subsectionKeys ?? []).flatMap((subsection) => [
        subsection.titleKey,
        ...subsection.paragraphKeys,
      ]),
    ]),
  ]),
]
