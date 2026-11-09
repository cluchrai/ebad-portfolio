// All portfolio content lives here. Edit this file to update the site.

export const profile = {
  name: 'Muhammad Ebad Hafeez',
  shortName: 'Ebad',
  roles: ['Game developer'],
  location: 'Karachi, Pakistan',
  email: 'ebadhafeez0504@gmail.com',
  phone: '+92 330 8639836',
  linkedin: 'https://linkedin.com/in/muhammad-ebad-hafeez',
  github: null, // e.g. 'https://github.com/your-username'
  cv: '/media/Muhammad_Ebad_Hafeez_CV.pdf',
  intro:
    'I build game worlds in Unreal and Unity, and the systems behind products in Node.js and Next.js. Fourth-year Computing & IT student at NED University, specialising in gaming and animation.',
  about: [
    'I work at the point where games and software meet. On the game side I design levels, build environments and write gameplay logic in Unreal Engine and Unity, including VR on Meta Quest 3. On the software side I also build web and backend products, from a multi-tenant SaaS now in pilot to the Node.js backend of a Ludo mobile game.',
    'I care about worlds that feel alive and tools that save people time. Most of my team projects put me in charge of the environment, and most of my solo projects put me in charge of everything.',
  ],
};

// Set url to '/models/avatar.glb' once the Blender export is in client/public/models
export const avatar = {
  url: '/models/avatar.glb',
};

// Shown in the avatar's LEVEL UP animation, newest first
export const recentSkills = ['Three.js', 'React Three Fiber', 'Blender', 'RAG chatbots'];

export const skillGroups = [
  {
    title: 'Web & backend',
    items: ['React', 'Next.js', 'Node.js', 'JavaScript', 'PostgreSQL', 'Supabase', 'PHP / Laravel'],
  },
  {
    title: 'Game engines',
    items: ['Unreal Engine', 'Blueprint scripting', 'Unity 3D / 2D', 'Unity AR / VR', 'Meta Quest 3 / XR'],
  },
  {
    title: 'World building',
    items: ['Level design', 'Environment art', 'Game UI development'],
  },
  {
    title: 'Art & design tools',
    items: ['Blender (basic)', 'Canva'],
  },
];

// category: 'web' | 'game' | 'xr'   image: null shows a placeholder thumbnail
// Shown in this order. The award-winning game goes first, then the other award winner.
export const projects = [
  {
    id: 'two-lights',
    title: 'Two Lights One Escape',
    subtitle: 'Co-op puzzle platformer',
    category: 'game',
    description:
      'A 3D split-reality co-op puzzle platformer for two local players, who coordinate across mirrored rooms to escape together. Winner of GameCon at NED University (1st place).',
    role: 'Level design for 2 levels, environment art across most levels',
    party: 'Team of 3',
    reward: '1st place, GameCon',
    tags: ['Unity 3D', 'Local co-op'],
    image: null,
    links: [],
  },
  {
    id: 'taleem360',
    title: 'Taleem360',
    subtitle: 'AR learning app (FYDP)',
    status: 'Ongoing, continuing next semester',
    category: 'xr',
    description:
      'An augmented-reality learning app for Class 6–10 students of Pakistani government schools. It turns textbook diagrams into 3D models that students explore part by part, so they can see how each part works and understand the course visually.',
    role: 'Subject tabs, 3D model integration and ongoing development (Sem 7 to present)',
    party: 'Team FYDP',
    reward: 'Best FYDP, Techfest 2026',
    tags: ['AR', '3D models'],
    image: null,
    links: [],
  },
  {
    id: 'rfq-saas',
    title: 'RFQ-to-Invoice SaaS',
    subtitle: 'Aviation parts trading',
    status: 'In pilot with early customers',
    category: 'web',
    description:
      'A multi-tenant SaaS that automates the RFQ-to-invoice workflow for aviation parts trading companies. Now in pilot with early customers.',
    role: 'Solo developer: designed, built and shipped it end to end',
    party: 'Solo',
    tags: ['Next.js', 'Supabase', 'Multi-tenant'],
    image: null,
    links: [],
  },
  {
    id: 'ludo-backend',
    title: 'Ludo Mobile Game Backend',
    subtitle: 'Realtime game server',
    category: 'web',
    description:
      'Backend for a Ludo mobile game, built in Node.js with PostgreSQL and connected to the Unity game client.',
    role: 'Backend development and Unity-to-Node.js integration',
    tags: ['Node.js', 'PostgreSQL', 'Unity'],
    image: null,
    links: [],
  },
  {
    id: 'tiny-village',
    title: 'Tiny Village',
    subtitle: 'Survival horror',
    category: 'game',
    description:
      'A single-player survival horror game inspired by Dead by Daylight. The player activates enemy-guarded generators across an abandoned village to unlock a hidden escape route. Showcased at GameCon 2026 at NED University.',
    role: 'Full game environment, generator and gate logic, UI systems, combat contributions',
    party: 'Team of 3',
    rewardLabel: 'Showcase',
    reward: 'GameCon 2026, NED University',
    tags: ['Unreal Engine', 'Survival horror'],
    image: null,
    links: [],
  },
  {
    id: 'underwater-vr',
    title: 'Underwater VR Experience',
    subtitle: 'Ocean exploration',
    category: 'xr',
    description:
      'Immersive VR ocean exploration on Meta Quest 3. Players explore an underwater world from a submarine with full locomotion and gesture-based swimming.',
    role: 'Full ocean exterior environment design and implementation',
    party: 'Team of 4',
    tags: ['Meta Quest 3', 'Unity VR'],
    image: null,
    links: [],
  },
];

export const projectFilters = [
  { id: 'all', label: 'All' },
  { id: 'game', label: 'Games' },
  { id: 'xr', label: 'VR / XR' },
  { id: 'web', label: 'Web & backend' },
];

// Newest first
export const journey = [
  {
    kind: 'work',
    title: 'Game Developer Intern',
    place: 'Game Storm Studios (GSS), Karachi',
    when: 'Jun 2026 – Aug 2026',
    text: 'Worked at a professional game studio, gaining hands-on experience in game development workflows and practices.',
  },
  {
    kind: 'work',
    title: 'IT Department Intern',
    place: 'DIL – Civic Center, Karachi',
    when: 'Internship',
    text: 'Gained exposure to professional IT operations and office workflows in a civic-sector organisation.',
  },
  {
    kind: 'study',
    title: 'Bachelor of Computing & IT (BCIT)',
    place: 'NED University of Engineering and Technology',
    when: '2023 – 2027 (expected)',
    text: 'Specialisation in Gaming & Animation. Currently in fourth year.',
  },
];

export const achievements = [
  {
    title: 'Best FYDP, Techfest 2026',
    text: "Awarded Best Final Year Design Project at NED University's Techfest 2026 for Taleem360, an AR learning app for government school students.",
  },
  {
    title: '1st place, GameCon',
    text: 'Won first position with Two Lights One Escape. Prize and Logitech-sponsored gifts.',
  },
  {
    title: '1st place, NED departmental evaluation',
    text: 'First position in the departmental project evaluation, with a certificate of excellence.',
  },
];

export const courses = [
  { title: 'Unity 2D & 3D Game Development', by: 'NED University' },
  { title: 'Unreal Engine Development', by: 'CEGA, Centre of Excellence in Gaming & Animation' },
  { title: 'AR / VR Development on Meta Quest 3', by: 'NED University' },
  { title: 'Pre-production for Animation & Design', by: 'CEGA, Centre of Excellence in Gaming & Animation' },
];

// Set src to '/media/promo.mp4' once the After Effects export is ready
export const showreel = {
  src: null,
  poster: null,
};
