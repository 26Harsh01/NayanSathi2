import type { Language } from '../../types';

export interface VirtualKey {
  id: string;
  label: string;
  value: string;
  action?: 'space' | 'backspace' | 'clear' | 'enter' | 'toggle-numbers';
  wide?: boolean;
}

export const EN_LETTER_ROWS: VirtualKey[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map((ch) => ({
    id: `en_${ch}`,
    label: ch,
    value: ch.toLowerCase(),
  })),
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map((ch) => ({
    id: `en_${ch}`,
    label: ch,
    value: ch.toLowerCase(),
  })),
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '?'].map((ch) => ({
    id: `en_${ch}`,
    label: ch,
    value: ch.toLowerCase(),
  })),
];

export const HI_LETTER_ROWS: VirtualKey[][] = [
  ['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ए', 'ऐ', 'ओ', 'औ'].map((ch) => ({
    id: `hi_${ch}`,
    label: ch,
    value: ch,
  })),
  ['क', 'ख', 'ग', 'घ', 'च', 'छ', 'ज', 'झ', 'ट', 'ठ'].map((ch) => ({
    id: `hi_${ch}`,
    label: ch,
    value: ch,
  })),
  ['ड', 'ढ', 'त', 'थ', 'द', 'ध', 'न', 'प', 'फ', 'ब'].map((ch) => ({
    id: `hi_${ch}`,
    label: ch,
    value: ch,
  })),
  ['भ', 'म', 'य', 'र', 'ल', 'व', 'श', 'स', 'ह', '।'].map((ch) => ({
    id: `hi_${ch}`,
    label: ch,
    value: ch,
  })),
  ['ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं'].map((ch) => ({
    id: `hi_m_${ch}`,
    label: ch,
    value: ch,
  })),
];

export const NUMBER_ROWS: VirtualKey[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((ch) => ({
    id: `num_${ch}`,
    label: ch,
    value: ch,
  })),
  ['.', ',', '?', '!', '-', ':', '/', '(', ')', '@'].map((ch) => ({
    id: `sym_${ch}`,
    label: ch,
    value: ch,
  })),
];

export function getControlRow(language: Language, showNumbers: boolean): VirtualKey[] {
  return [
    {
      id: 'ctrl_num',
      label: showNumbers ? (language === 'hi' ? 'अक्षर' : 'ABC') : '123',
      value: '',
      action: 'toggle-numbers',
      wide: true,
    },
    {
      id: 'ctrl_space',
      label: language === 'hi' ? 'स्पेस' : 'Space',
      value: ' ',
      action: 'space',
      wide: true,
    },
    {
      id: 'ctrl_back',
      label: language === 'hi' ? 'मिटाएँ' : 'Backspace',
      value: '',
      action: 'backspace',
      wide: true,
    },
    {
      id: 'ctrl_clear',
      label: language === 'hi' ? 'साफ़ करें' : 'Clear',
      value: '',
      action: 'clear',
    },
    {
      id: 'ctrl_enter',
      label: language === 'hi' ? 'बोलें' : 'Speak',
      value: '',
      action: 'enter',
      wide: true,
    },
  ];
}
