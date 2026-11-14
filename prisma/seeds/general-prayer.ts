import { db } from '../../src/utils/db-connection'
import { sanitizePrayerRichText } from '../../src/utils/sanitize-prayer-rich-text'

/*
 * General Prayer content seed (GP-DB-03).
 *
 * Transcribed from `docs/general-prayer-list.pdf` (image-only, 12.–21.11.2026,
 * 10 entries). Appendix A of `docs/new-feature/general-prayer.md` is the source
 * of every string below — proofread against the PDF before the production seed.
 *
 * `sequence` is the cycle position, so the upsert key is `sequence`: re-running
 * the seed refreshes the copy and never duplicates a day. `slug` derives from
 * the position and stays stable once public links exist.
 *
 * Eight of the ten entries are weekday-specific in the source ("12. Neljapäev");
 * that label is deliberately not stored — the send date is the real date (R2).
 */

type SeedPrayer = {
  sequence: number
  title: string
  verse: string
  verseReference: string
  body: string
  references: string | null
  liturgicalNote?: string
}

const PRAYERS: SeedPrayer[] = [
  {
    sequence: 1,
    title: 'Hoia oma jalga, kui sa lähed Jumala kotta',
    verse:
      'Hoia oma jalga, kui sa lähed Jumala kotta. Kuulaminek on parem kui alpide ohvriand. Jäta oma and altari ette ja mine lepi esmalt ära oma vennaga ja alles siis tule ja too oma and!',
    verseReference: 'Kg 4,17; Mt 5,24',
    body: '<p>Kes võib tulla Jumala ligi? See, kes on laitmatu. Mina ei ole laitmatu, kas ma ei tohi tulla? Issand, Sinu Sõna ütleb: tohin küll, kui ma tahan Sind kuulda võtta, kui ma igatsen paranemist.</p>',
    references: 'Lk 9,51–56; Ilm 20,1–6',
  },
  {
    sequence: 2,
    title:
      'Et su silmad oleksid lahti ööd ja päevad selle koja kohal, selle paiga kohal, mille kohta sa oled öelnud: Seal peab olema minu nimi',
    verse:
      'Et su silmad oleksid lahti ööd ja päevad selle koja kohal, selle paiga kohal, mille kohta sa oled öelnud: Seal peab olema minu nimi. Jeesus ütles oma vanemaile: Miks te siis olete mind otsinud? Kas te ei teadnud, et ma pean olema neis paigus, mis on mu Isa päralt?',
    verseReference: '1Kn 8,29; Lk 2,49',
    body: '<p>Armas Jumal, ma tänan Sind kiriku eest, eriti oma kodukiriku eest. Üks päev Sinu õuedes on parem kui muid tuhat. Igal pühapäeval võime tulla kirikusse kuulama Sinu Sõna ning saama osa Kristuse ihust ja verest. Siin meid õnnistatakse, siin oleme koos Jumala rahvaga. Siin oled Sina, Jeesus, meie keskel.</p>',
    references: 'Jh 18,10.11; Ilm 20,7–10',
  },
  {
    sequence: 3,
    title: 'Olgu Issand, meie Jumal, meiega, nõnda nagu ta on olnud meie vanematega',
    verse:
      'Olgu Issand, meie Jumal, meiega, nõnda nagu ta on olnud meie vanematega. Paulus ütles: Me kuulutame teile selle hea sõnumi, tõotuse, mis anti meie esiisadele, et Jumal selle on täitnud meile, nende lastele, äratades üles Jeesuse.',
    verseReference: '1Kn 8,57; Ap 13,32–33',
    body: '<p>Mõtlen tänulikult eelnevatele sugupõlvedele. Nende hulgas on olnud Jumala lapsi, kelle palved õnnistavad järgnevaid sugupõlvi. Ehk on keegi neist minugi eest palunud, et Sina, Issand, oled minu kätte saanud. Mina palun järgnevate sugupõlvede eest. Issand, hoia ja õnnista neid!</p>',
    references: '1Pt 3,8–17; Ilm 20,11–15',
  },
  {
    sequence: 4,
    title: 'Nad võivad elada julgelt, ilma et keegi neid peletaks',
    verse:
      'Nad võivad elada julgelt, ilma et keegi neid peletaks. Põrgu väravad ei saa minu kogudusest võitu.',
    verseReference: 'Hs 34,28; Mt 16,18',
    body: '<p><em>Me kõik peame saama avalikuks Kristuse kohtujärje ees. 2Kr 5,10a</em></p><p><em>Mt 25,31–46; Jr 8,4–7; Ps 50</em></p><p>Me vajame julgustuse sõnu. Eks ole see maailm nagu ohtlik ja tormine meri? Sina, Issand, julgustad meid ja tuletad meile meelde, et Sa oled meiega ja hoiad meid püsti, et me ei hukkuks. Sinuga koos me jääme ellu.</p>',
    references: 'Jutlus: 2Kr 5,1–10',
    liturgicalNote: 'EELVIIMANE PÜHAPÄEV KIRIKUAASTAS',
  },
  {
    sequence: 5,
    title: 'Kes ei peaks sind kartma, rahvaste kuningas?',
    verse:
      'Kes ei peaks sind kartma, rahvaste kuningas? Tõesti, seda sa väärid. Hananias ütles Paulusele: Meie isade Jumal on su määranud tunnetama tema tahtmist ja nägema seda Õiget ning kuulma häält tema suust, sest sina saad tema tunnistajaks kõigile inimestele selles, mida sa oled näinud ja kuulnud.',
    verseReference: 'Jr 10,7; Ap 22,14–15',
    body: '<p>Me teame, et ei ole kedagi sellist nagu Sina, Issand, kõigeväeline. Aga kas me sellest kõneleme või hoiame selle kalli teadmise ainult endale? Siis on ju sellest vähe kasu. Issand, aita mind, et ma ei lukustaks Sind oma südamesse.</p>',
    references: 'Mt 25,14–20; Ilm 21,1–8',
  },
  {
    sequence: 6,
    title: 'Tema aga kandis paljude pattu ja seisis üleastujate eest',
    verse:
      'Tema aga kandis paljude pattu ja seisis üleastujate eest. Johannes näeb Jeesust tulevat tema juurde ja ta ütleb: "Vaata, see on Jumala Tall, kes võtab ära maailma patu!"',
    verseReference: 'Js 53,12; Jh 1,29',
    body: '<p>Jumala Tall, kes Sa kannad ära maailma patu, me täname Sind, et Sa võtsid kanda ka meie patud. Need rõhusid ja vaevasid Sind seal ristipuul. Sinu kannatus ja surm on meile priiuse toonud. Sina seisaid meie eest veelgi. Aitäh Sulle!</p>',
    references: 'Jr 8,4–9; Ilm 21,9–14',
  },
  {
    sequence: 7,
    title: 'Sind ma armastan südamest, Issand, mu vägi!',
    verse:
      'Sind ma armastan südamest, Issand, mu vägi! Jeesus ütles patuse naise kohta: Temale on palju patte andeks antud, sest ta on palju armastanud. Aga kellele antakse andeks pisut, see armastab pisut.',
    verseReference: 'Ps 18,2; Lk 7,47',
    body: '<p>Issand, Jeesus, Sina oled minu ja kogu inimkonna heaks teinud enam kui keegi teine. Sinul on õigus meie armastusele. Aga armastada saab see, kes mõistab, kes on kuulnud, kes teab. Seepärast ma palun Sind, olgu Sõna uksed meile ikka valla, et me õpiksime Sind armastama.</p>',
    references: null,
  },
  {
    sequence: 8,
    title:
      'Ma päästan nad kõigist nende asupaigust, kus nad on pattu teinud, ja puhastan nad, ja nad on mulle rahvaks',
    verse:
      'Ma päästan nad kõigist nende asupaigust, kus nad on pattu teinud, ja puhastan nad, ja nad on mulle rahvaks. Jumal, kes on rikas halastuselt, on meid koos Kristusega teinud elavaks oma suure armastuse pärast, millega ta meid on armastanud.',
    verseReference: 'Hs 37,23; Ef 2,4–5',
    body: '<p>Usurahvas on õppiv rahvas. Jumala Sõna on meie õpik, praktika meie igapäevane elu. Me oleme teelolijad, kes õppides ja Jumala rahva meelsust omandades on teel igavesele kodumaale. Issand, ära väsi meid õpetamast ja juhatamast.</p>',
    references: '2Ts 1,3–12; Ilm 22,1–5',
  },
  {
    sequence: 9,
    title: 'Issand ütles Moosesele: Nüüd mine, ja mina olen abiks sinu suule',
    verse:
      'Issand ütles Moosesele: Nüüd mine, ja mina olen abiks sinu suule ning õpetan sind, mida sa pead rääkima. Jeesus ütles Peetrusele: Mina olen sinu pärast Jumalat palunud, et su usk ei lõpeks. Ja kui sa ükskord pöördud, siis kinnita oma vendi.',
    verseReference: '2Ms 4,12; Lk 22,32',
    body: '<p>Issand Jeesus, ole alati minuga, kui ma Sinust kõnelen! Ma ei taha rääkida Sinu kohta valet, seepärast ma palun Sind: ole abiks minu suule, et ma õigust räägiksin, et see oleks kinnituseks ja kosutuseks kuulajatele.</p>',
    references: 'Hb 13,17–21; Ilm 22,6–15',
  },
  {
    sequence: 10,
    title:
      'Jumal ütleb: Minu sõna ei tule tagasi mu juurde tühjalt, vaid teeb, mis on mu meele järgi, ja saadab korda, milleks ma selle läkitasin',
    verse:
      'Jumal ütleb: Minu sõna ei tule tagasi mu juurde tühjalt, vaid teeb, mis on mu meele järgi, ja saadab korda, milleks ma selle läkitasin. Jumala sõna on elav ja tõhus ja vahedam kui ükski kaheterane mõõk ning tungib läbi, kuni ta eraldab hinge ja vaimu, liigesed ja üdi, ning on südame meelsuse ja kaalutluste hindaja.',
    verseReference: 'Js 55,11; Hb 4,12',
    body: '<p>Jumala Sõna, tule minu juurde, tungi minusse, puuduta mind, et ma ei oleks üksnes Sõna kuulja, vaid ka selle järgi tegija.</p>',
    references: '2Pt 3,(13)14–18; Ilm 22,16–21',
  },
]

export const seedGeneralPrayers = async () => {
  const creator = await db.user.findUnique({ where: { email: 'admin@catatia.com' } })
  if (!creator) throw new Error('seedGeneralPrayers: the admin actor is missing (seedUsers)')

  for (const prayer of PRAYERS) {
    const body = sanitizePrayerRichText(prayer.body)
    if (body.length === 0)
      throw new Error(`seedGeneralPrayers: sequence ${prayer.sequence} lost its body`)

    const data = {
      slug: `paivapalve-${prayer.sequence}`,
      title: prayer.title,
      introduction: null,
      body,
      verse: prayer.verse,
      verse_reference: prayer.verseReference,
      liturgical_note: prayer.liturgicalNote ?? null,
      references: prayer.references,
      language_code: 'et',
      is_active: true,
      created_by: creator.id,
    }

    await db.generalPrayer.upsert({
      where: { sequence: prayer.sequence },
      create: { ...data, sequence: prayer.sequence },
      // Copy refreshes; the audio is left untouched so a re-seed never
      // discards a generated file.
      update: data,
    })
  }
}
