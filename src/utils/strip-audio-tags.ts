/**
 * Removes ElevenLabs audio tags such as "[warm]" or "[thoughtful, reflective]" from prayer text
 * shown to readers. The stored text keeps them for speech generation.
 * ponytail: any single-line "[...]" is treated as a tag, so genuine bracketed text is removed too.
 */
export const stripAudioTags = (text: string) =>
  text
    .replace(/[ \t]*\[[^\]\n]*\][ \t]*/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim()
