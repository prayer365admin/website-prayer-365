import { StarFilled } from '@/components/icon/antd-icons'
import Image from 'next/image'
import { TESTIMONIALS } from './data'

export default function WelcomeTestimonials() {
  return (
    <section
      aria-label="Voices in Communion"
      className="py-16 md:py-24 px-6 max-w-[1280px] mx-auto"
    >
      {/* Header */}
      <div className="text-center max-w-[640px] mx-auto mb-12">
        <div className="rounded-full bg-[#E6EDFB] px-4 py-1 w-fit mx-auto text-[#2F7AD2] text-[10px] tracking-[2px] uppercase font-semibold mb-3">
          Voices in Communion
        </div>
        <h2 className="text-[32px] md:text-[36px] font-bold text-[#0E203E] leading-tight">
          Pastoral Solidarity &amp; Testimonies
        </h2>
        <p className="text-[15px] text-[#5C6370] mt-3 leading-relaxed">
          Reflections from parish priests, diocesan deacons, and daily worshippers across our
          regional fellowship.
        </p>
      </div>

      {/* 3 Testimonial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((item) => (
          <div
            className="rounded-2xl bg-white p-7 flex flex-col justify-between shadow-sm border border-[#E6EDFB]"
            key={item.author}
          >
            <div>
              {/* Star Rating */}
              <div aria-label="5 stars rating" className="flex items-center gap-1 mb-4" role="img">
                {[...Array(5)].map((_, i) => (
                  <StarFilled className="!text-[#F59E0B] text-[14px]" key={i} />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="font-font_quote italic text-[18px] md:text-[20px] leading-[26px] text-[#191C1E] mb-6">
                {item.quote}
              </blockquote>
            </div>

            {/* Author Footer */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#F2F4F6]">
              <Image
                alt=""
                aria-hidden
                className="h-10 w-10 shrink-0 rounded-full object-cover shadow-xs"
                height={40}
                src={item.avatarUrl}
                unoptimized
                width={40}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-semibold text-[#0E203E] truncate">
                  {item.author}
                </span>
                <span className="text-[12px] text-[#5C6370] truncate">{item.role}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
