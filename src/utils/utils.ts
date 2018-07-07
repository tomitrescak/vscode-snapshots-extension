import * as path from 'path';

export function findMatchingBracket(
  text: string,
  position: number,
  openBracket = '{',
  closeBracket = '}',
  increment = -1
) {
  let brackets = 1;
  while (text[position] != undefined && brackets > 0) {
    if (text[position] === openBracket) {
      brackets--;
    } else if (text[position] === closeBracket) {
      brackets++;
    }
    position += increment;
  }
  return position;
}
