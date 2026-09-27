import { DashboardSocialFacebook } from '@/components/icon/dashboard-social-facebook'
import { DashboardSocialInstagram } from '@/components/icon/dashboard-social-instagram'
import { DashboardSocialLinkedin } from '@/components/icon/dashboard-social-linkedin'
import { DashboardSocialTikTok } from '@/components/icon/dashboard-social-tiktok'
import { DashboardSocialTwitter } from '@/components/icon/dashboard-social-twitter'

export const SocialMediaData = [
  {
    value: 'INSTAGRAM',
    label: (
      <div className="dashboard-social-select">
        <span>
          <DashboardSocialInstagram />
        </span>
        Instagram
      </div>
    ),
  },
  {
    value: 'FACEBOOK',
    label: (
      <div className="dashboard-social-select">
        <span>
          <DashboardSocialFacebook />
        </span>
        Facebook
      </div>
    ),
  },
  {
    value: 'TIK-TOK',
    label: (
      <div className="dashboard-social-select">
        <span>
          <DashboardSocialTikTok />
        </span>
        TikTok
      </div>
    ),
  },
  {
    value: 'LINKEDIN',
    label: (
      <div className="dashboard-social-select">
        <span>
          <DashboardSocialLinkedin />
        </span>
        Linkedin
      </div>
    ),
  },
  {
    value: 'TWITTER',
    label: (
      <div className="dashboard-social-select">
        <span>
          <DashboardSocialTwitter />
        </span>
        Twitter
      </div>
    ),
  },
]
