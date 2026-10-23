export const site = {
  name: 'Jorge Aviles',
  url: 'https://jorgeaviles.net',
  email: 'jorge@jorgeaviles.net',
  description:
    'Business analysis, data platforms, and applied research. Turning complex information into useful decisions and systems.',
  headline: 'Turning complex information into useful decisions and systems.',
  github: 'https://github.com/jorgeaviles',
  linkedin: 'https://www.linkedin.com/in/jraviles/',
  profileSource:
    'https://github.com/jorgeaviles/jorgeaviles/blob/main/README.md',
} as const;

export const navigation = [
  { label: 'About', href: '/about/' },
  { label: 'Work', href: '/work/' },
  { label: 'Research', href: '/research/' },
  { label: 'Lab', href: '/lab/' },
  { label: 'Contact', href: '/contact/' },
] as const;
