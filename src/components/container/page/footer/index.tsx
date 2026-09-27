'use client'

import Image from 'next/image'
import BoxContainer from '@/components/container/boxed'
import { SocialMediaFooterData } from '@/data/social-media-footer'
import { LocationPinIcon } from '@/components/icon/location-pin'
import { PhoneIcon } from '@/components/icon/phone'
import s from './index.module.scss'

export default function ContainerPageFooter() {
  return (
    <div className="relative text-white_color">
      <footer>
        <BoxContainer
          containerClassName="py-20"
          sectionClassName="bg-black_color z-20 relative py-6 xl:py-0"
        >
          <div className="flex flex-wrap justify-between ">
            <div className="w-full lg:w-[70%]">
              <div className="w-[150px] aspect-video relative">
                <Image src={'/images/logo.png'} fill alt="logo" style={{ objectFit: 'contain' }} />
              </div>
              <div className="w-full lg:w-[50%] mt-6 text-[18px]">
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Dignissimos quae sint
                veritatis ad, aspernatur, quo aperiam amet alias, quis suscipit blanditiis molestias
                id eum! Rem repellendus repellat nostrum iste maxime?
              </div>
            </div>
            <div className="w-full mt-10 pr-6 lg:pr-0 lg:mt-0 lg:w-[30%]">
              <h2 className="uppercase text-[16px] mb-10 font-bold">Contact Us</h2>
              <div className="flex flex-wrap gap-y-4">
                <div className="w-full flex flex-wrap gap-4">
                  <span>
                    <PhoneIcon />
                  </span>
                  +62812-3456-7890
                </div>
                <div className="w-full flex flex-wrap gap-4">
                  <span>
                    <LocationPinIcon />
                  </span>
                  <div className="w-[80%] grow">
                    Jl. Padma Gg Jaya Raya No.7, Denpasar Timur, Bali 80238
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-between items-center pt-20 lg:pt-[180px]">
            <div className="w-full lg:w-fit mb-6 lg:mb-0 ">
              <div className="text-[18px]">© Catalyst Inertia All rights reserved.</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SocialMediaFooterData.map((item) => (
                <div key={item.key}>
                  <a href={item.url} target="_blank" className={s.icon}>
                    {item.icon}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </BoxContainer>
      </footer>
    </div>
  )
}
