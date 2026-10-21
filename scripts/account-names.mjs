import {randomInt} from 'node:crypto';

export function randomAccountName() {
  const letters='abcdefghjkmnpqrstuvwxyz';
  const characters=letters+'23456789';
  return letters[randomInt(letters.length)]+Array.from({length:11},()=>characters[randomInt(characters.length)]).join('');
}
