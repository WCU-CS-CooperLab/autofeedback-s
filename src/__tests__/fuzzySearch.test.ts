import {fuzzySearch} from '../fuzzySearch'

describe('fuzzySearch', () => {
  it('finds a close word in a group of words', async () => {
    const sentence = 'The quick brown fox jumped over the lazy dog.'
    expect(fuzzySearch(sentence, 'brwon')).toBe('brown')
  }, 10000)

  it('finds a line in an input', async () => {
    const input =
      'f1.numerator    = [a]\n' +
      'f1.denominator  = [c]\n' +
      'f1              = ( a ) / ( c )\n' +
      'f2              = ( b miles ) / ( hour )\n' +
      'f3              = ( x y hour ) / ( b )\n' +
      'f4              = ( ) / ( )\n' +
      'f1 * f2         = ( a b miles ) / ( c hour )\n' +
      'f3 * f2         = ( x y miles ) / ( )\n' +
      'f1 * f4         = ( a ) / ( c )'
    expect(fuzzySearch(input, 'f1              = a / c')).toBe('f1              = ( a )')
  }, 10000)
})
