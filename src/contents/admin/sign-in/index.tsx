import type { Metadata } from 'next'
import {
  DiocesanGovernanceIcon,
  ProtectedPastoralCareIcon,
  SanctuaryWorkspaceIcon,
} from './feature-icons'
import Image from 'next/image'
import AuditNotice from './audit-notice'
import AuthCardHeader from './auth-card-header'
import SignInForm from './form'

export const metadata: Metadata = { title: 'Staff Sign-in - PRAYER 365 Admin Suite' }

export default function ContentsAdminSignIn() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F6F8FC] lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Right (auth) column is first in DOM for mobile accessibility */}
      <section className="flex w-full flex-1 items-center justify-center bg-[#F5F7FF] px-4 py-8 sm:px-6 sm:py-12 lg:order-2 lg:h-screen lg:w-[52%] xl:w-[48%] 2xl:w-[45%] lg:overflow-y-auto lg:px-6 xl:px-10 2xl:px-12 lg:py-8">
        <div className="my-auto w-full max-w-[512px] rounded-2xl border border-[#E6EDFB] bg-white p-5 shadow-sm sm:rounded-3xl sm:p-8">
          {/* Header */}
          <AuthCardHeader />

          <h2 className="mt-5 text-xl font-semibold tracking-[-0.5px] text-[#0E203E] sm:mt-6 sm:text-2xl sm:tracking-[-1px]">
            Sign In to Your Workspace
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-[#5C6370] sm:text-sm">
            Enter your diocesan credentials or staff credentials to access your church
            administration console.
          </p>

          {/* Auth form (client) */}
          <div className="mt-5 sm:mt-6">
            <SignInForm />
          </div>

          {/* Audit notice */}
          <div className="mt-4">
            <AuditNotice />
          </div>
        </div>
      </section>

      {/* Left (hero) column */}
      <section className="relative hidden w-[48%] xl:w-[52%] 2xl:w-[55%] max-w-[756px] flex-col justify-between overflow-x-hidden overflow-y-auto border-r border-[#E2E8F0]/80 bg-[image:radial-gradient(150.88%_100.25%_at_20%_15%,rgba(219,234,254,0.7)_0%,rgba(239,246,255,0.4)_35%,rgba(248,250,252,0.95)_80%),linear-gradient(176.67deg,#E0F2FE_0%,#F0F7FF_38%,#F8FAFC_100%)] px-6 py-5 lg:flex lg:h-screen lg:order-1 xl:px-10 xl:py-7 2xl:px-14 2xl:py-8">
        {/* Decorative background layers */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[image:radial-gradient(116.61%_77.48%_at_50%_30%,rgba(59,130,246,0.15)_0%,transparent_70%)]" />
          <div className="absolute -left-20 -top-24 h-[384px] w-[384px] rounded-full bg-[rgba(96,165,250,0.1)] blur-[32px]" />
          <div className="absolute -right-20 top-[25%] h-[464px] w-[500px] rounded-full bg-[rgba(186,230,253,0.25)] blur-[32px]" />
        </div>

        {/* Top bar */}
        <div className="relative z-[3] flex w-full items-center justify-end">
          <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#5C6370]">
            FAITH · BELONG · GIVE · GROW
          </span>
        </div>

        {/* Center block */}
        <div className="relative z-[3] my-auto flex flex-col items-start py-1 xl:py-2">
          <Image
            src="/images/logo.png"
            width={48}
            height={48}
            alt=""
            className="h-9 w-9 xl:h-11 xl:w-11 2xl:h-12 2xl:w-12"
            style={{ objectFit: 'contain' }}
          />
          <h1 className="mt-1.5 text-2xl font-extrabold leading-none tracking-[-1px] text-[#0F172A] xl:mt-2.5 xl:text-3xl 2xl:text-4xl">
            Prayer 365
          </h1>
          <p className="mt-1 text-[11px] font-semibold text-[#64748B] xl:text-xs 2xl:text-sm">
            ADMINISTRATION & SANCTUARY SUITE
          </p>
          <p className="mt-2 border-l-2 border-[#77B4F2] pl-3 text-[11px] text-[#475569] xl:mt-3 xl:text-xs 2xl:text-sm">
            Everyday faith. A more connected tomorrow. Faith, People, Places — A Brighter Tomorrow.
          </p>

          {/* Three feature cards */}
          <div className="mt-3 w-full space-y-2 xl:mt-4 xl:space-y-2.5 2xl:space-y-3">
            <div className="flex gap-3 rounded-xl border border-white/85 bg-white/65 p-2.5 shadow-sm xl:p-3 2xl:p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B9D8F8] xl:h-9 xl:w-9 2xl:h-10 2xl:w-10">
                <SanctuaryWorkspaceIcon />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0F172A] xl:text-sm">
                  Multi-Tenant Sanctuary Workspace
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#5C6370] xl:text-xs">
                  Oversee liturgical calendars, audio reflection feeds, parish notifications, and
                  daily pastoral services in real time.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-white/85 bg-white/65 p-2.5 shadow-sm xl:p-3 2xl:p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F7CACA] xl:h-9 xl:w-9 2xl:h-10 2xl:w-10">
                <DiocesanGovernanceIcon />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0F172A] xl:text-sm">
                  Diocesan & Central Governance
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#5C6370] xl:text-xs">
                  Seamless synchronization with archdeaconry tiers, clergy certification, and vetted
                  ministerial access hierarchy.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-white/85 bg-white/65 p-2.5 shadow-sm xl:p-3 2xl:p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D3FAEF] xl:h-9 xl:w-9 2xl:h-10 2xl:w-10">
                <ProtectedPastoralCareIcon />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0F172A] xl:text-sm">
                  Private & Protected Pastoral Care
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#5C6370] xl:text-xs">
                  Zero-knowledge ecclesiastical encryption ensuring confidentiality for parish
                  prayer requests and counseling logs.
                </p>
              </div>
            </div>
          </div>
        </div>
        {/* Hero footer */}
        <div className="relative z-[3] w-full border-t border-[#E2E8F0]/70 pt-3 pb-0.5 xl:pt-4">
          <div className="flex items-center gap-4 text-[11px] text-[#8F96A3] xl:text-xs">
            <span>Privacy Charter</span>
            <span>Safeguarding Standards</span>
          </div>
        </div>
      </section>
    </main>
  )
}
