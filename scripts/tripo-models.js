// ============================================================
//  Tripo model registry
//
//  Single source of truth for every Tripo-generated GLB used in
//  the project. The key (left side) becomes the static filename
//  saved at  /models/<key>.glb  by  scripts/generate-models.mjs.
//
//  Workflow when adding a new model:
//    1. Add an entry below.
//    2. Run:  node --env-file-if-exists=/vercel/share/.env.project \
//                  scripts/generate-models.mjs
//       (the script skips models that already exist on disk).
//    3. Reference it in code via  mountTripoModel(parent, '<key>', opts).
// ============================================================

export const MODELS = {
  // ── Hub centerpiece + ambience ──────────────────────────────
  fountain: {
    prompt:
      'an ornate baroque white marble tiered fountain with golden trim, ' +
      'two round basins stacked on a fluted central pillar, lotus petal finial on top, ' +
      'water flowing from upper bowl into lower pool, classic European garden centerpiece, ' +
      'symmetric, photorealistic 3D product render, single isolated object',
  },
  plant_tropical: {
    prompt:
      'a tall lush tropical houseplant in a terracotta clay pot, wide green leaves, ' +
      'decorative interior decor piece, photorealistic 3D render, single isolated object',
  },
  chandelier: {
    prompt:
      'an ornate warm golden hanging chandelier with crystal teardrops, ' +
      'multiple soft glowing bulbs, brass frame, baroque elegant style, ' +
      'symmetric, hanging from a single mounting point at top, ' +
      'product render on transparent background',
  },

  // ── 5 hub-zone dioramas (one per portal platform) ──────────
  zone_chat: {
    prompt:
      'a cozy chat corner scene with a plush coral two-seat sofa, two cream cushions, ' +
      'a small round wooden coffee table beside it, a brass floor lamp with warm fabric shade, ' +
      'and a leafy potted plant, photorealistic interior decor render, single composition, ' +
      'isolated on transparent background',
  },
  zone_study: {
    prompt:
      'a study desk diorama with a wooden writing desk, a flat computer monitor on top, ' +
      'a swivel chair tucked under, and a tall bookshelf full of colourful books beside it, ' +
      'classroom study corner, photorealistic 3D render, single composition, ' +
      'isolated on transparent background',
  },
  zone_leisure: {
    prompt:
      'a leisure lounge corner with a soft purple armchair, a round pouffe ottoman beside it, ' +
      'a tall bookcase decorated with string lights, and a leafy potted plant, ' +
      'cozy reading nook, photorealistic 3D interior decor render, single composition, ' +
      'isolated on transparent background',
  },
  zone_healing: {
    prompt:
      'a Japanese zen meditation corner with a round green meditation cushion on a tatami mat, ' +
      'a low wooden tea table with a lit candle, a small bonsai or bamboo in a clay pot, ' +
      'serene minimal aesthetic, photorealistic 3D render, single composition, ' +
      'isolated on transparent background',
  },
  zone_games: {
    prompt:
      'a small round wooden game table on a single pedestal with a Go board on top, ' +
      'two black wooden stools tucked under it, classic chinese game corner, ' +
      'photorealistic 3D render, single composition, isolated on transparent background',
  },

  // ── ChatVRRoom ──────────────────────────────────────────────
  sofa_coral: {
    prompt:
      'a cozy modern three-seat living room sofa, sage green fabric upholstery, ' +
      'soft cushions, low wooden legs, front-facing, photorealistic furniture render',
  },
  coffee_table_round: {
    prompt:
      'a small round wooden coffee table with a glass top, light walnut frame, ' +
      'modern minimalist style, photorealistic 3D render, single isolated object',
  },
  armchair_beige: {
    prompt:
      'a beige fabric upholstered armchair with wooden legs, ' +
      'mid-century modern style, photorealistic furniture render, single isolated object',
  },
  bookshelf_walnut: {
    prompt:
      'a tall wooden bookshelf filled with colourful books, decorations and small plants, ' +
      'rustic dark walnut frame, photorealistic furniture render, single isolated object',
  },
  wall_art_landscape: {
    prompt:
      'a framed abstract landscape oil painting with soft blue and warm tones, ' +
      'gold ornate picture frame, hanging on a wall, photorealistic product render, ' +
      'single isolated object',
  },
  plant_leafy: {
    prompt:
      'a small leafy houseplant in a terracotta pot, green dense foliage, ' +
      'photorealistic 3D render, single isolated object',
  },

  // ── ChatVRRoom · cozy upgrade (warm-home theme) ─────────────
  fireplace_stone: {
    prompt:
      'a classic stacked stone fireplace with a wooden mantel shelf, glowing orange fire and burning logs inside, ' +
      'a few decorative books and a vase on the mantel, warm and cozy living-room piece, ' +
      'photorealistic 3D render, front-facing, single isolated object',
  },
  // (persian_rug removed — replaced with a procedural Three.js Plane in
  //  ChatVRRoom._makePersianRugTexture() so the carpet stays perfectly flat.)
  floor_lamp_brass: {
    prompt:
      'a tall brass floor lamp with a slim curved arm and a warm cream fabric drum shade, ' +
      'glowing soft yellow bulb, mid-century modern style, photorealistic 3D render, ' +
      'single isolated object',
  },
  side_table_walnut: {
    prompt:
      'a small square dark walnut side table with a single drawer and turned wooden legs, ' +
      'classic farmhouse style, photorealistic 3D render, single isolated object',
  },
  wall_clock_antique: {
    prompt:
      'a round antique wooden wall clock with roman numerals, brass hands, ' +
      'aged dark walnut frame, vintage style, hanging on a wall, ' +
      'photorealistic 3D render, single isolated object',
  },
  tea_set_porcelain: {
    prompt:
      'a delicate white porcelain tea set with blue floral pattern: a teapot, two teacups on saucers, ' +
      'a small sugar bowl, arranged on a wooden tray, photorealistic 3D render, ' +
      'single composition, isolated on transparent background',
  },
  photo_frames_set: {
    prompt:
      'a small group of three wooden picture frames of different sizes standing on a surface, ' +
      'family photos and a pressed flower inside, warm cozy decor, photorealistic 3D render, ' +
      'single composition, isolated on transparent background',
  },
  floor_cushion_round: {
    prompt:
      'a large round floor cushion pouffe in mustard yellow tufted velvet with gold tassels, ' +
      'plush and inviting, cozy living-room floor seat, photorealistic 3D render, ' +
      'single isolated object',
  },
  board_games_stack: {
    prompt:
      'a small stack of three vintage wooden board game boxes with colourful labels, ' +
      'a wooden chess box on top with a few pieces beside it, cozy game-night decor, ' +
      'photorealistic 3D render, single composition, isolated on transparent background',
  },
  vinyl_record_player: {
    prompt:
      'a vintage wooden record player turntable with a vinyl record on top, ' +
      'brass needle arm, two stacked vinyl albums beside it, retro warm aesthetic, ' +
      'photorealistic 3D render, single composition, isolated on transparent background',
  },
  window_curtain: {
    prompt:
      'a tall pair of warm beige linen curtains drawn back with a fabric tieback, ' +
      'gentle folds, ceiling-to-floor length, mounted on a brass curtain rod, ' +
      'photorealistic 3D render, single isolated object',
  },
  plant_pothos_hanging: {
    prompt:
      'a hanging pothos plant in a woven macrame holder, long trailing green and yellow vines, ' +
      'cozy interior decor, photorealistic 3D render, single isolated object',
  },

  // ── StudyVRRoom ─────────────────────────────────────────────
  student_desk_chair: {
    prompt:
      'a small classroom student desk with a wooden top and a matching simple wooden chair tucked underneath, ' +
      'school furniture set, photorealistic 3D render, single isolated object',
  },
  lectern_oak: {
    prompt:
      'a wooden classroom teacher lectern desk, polished oak, with a top reading slope and ' +
      'side bookshelf, classic schoolroom design, photorealistic furniture render',
  },
  bookshelf_classroom: {
    prompt:
      'a tall wooden classroom bookshelf filled with textbooks and folders, ' +
      'walnut frame, photorealistic furniture render, single isolated object',
  },

  // ── LeisureVRRoom ───────────────────────────────────────────
  cinema_seat_red: {
    prompt:
      'a deep red velvet cinema theatre seat with dark wooden armrests, cushioned backrest, ' +
      'classic movie theatre style, photorealistic 3D render, single isolated object',
  },
  side_table_bistro: {
    prompt:
      'a small black round bistro side table with a single pedestal leg, ' +
      'modern minimal style, photorealistic 3D render, single isolated object',
  },
  popcorn_bucket: {
    prompt:
      'a classic red and white striped paper popcorn bucket overflowing with golden buttered popcorn, ' +
      'cinema theme, photorealistic 3D render, single isolated object',
  },
  theater_curtain_red: {
    prompt:
      'red velvet theater curtain drape with golden tassel tieback, ' +
      'tall vertical pleats, photorealistic 3D model',
  },
  recliner_loveseat: {
    prompt:
      'a plush deep brown leather two-seat home-cinema recliner loveseat, ' +
      'oversized padded armrests with built-in cup holders, soft headrests, ' +
      'reclining backrests, modern luxury home theater seating, front-facing, ' +
      'photorealistic 3D furniture render, single isolated object',
  },
  movie_poster_classic: {
    prompt:
      'a framed vintage classic black and white movie poster, dramatic typography, ' +
      'ornate gold picture frame, hanging on a wall, retro cinema decor, ' +
      'photorealistic 3D render, single isolated object',
  },
  movie_poster_modern: {
    prompt:
      'a framed modern minimalist movie poster with bold colourful illustration ' +
      'and large stylised typography, sleek matte black picture frame, ' +
      'hanging on a wall, contemporary cinema decor, photorealistic 3D render, ' +
      'single isolated object',
  },
  popcorn_machine: {
    prompt:
      'a vintage red and gold popcorn cart machine on small wheels, glass display case ' +
      'full of fluffy golden popcorn, ornate gold trim and finials, marquee sign on top ' +
      'reading POPCORN, classic 1950s movie theatre snack bar piece, front-facing, ' +
      'photorealistic 3D render, single isolated object',
  },
  wall_sconce_theater: {
    prompt:
      'an elegant brass art-deco wall sconce with a frosted amber glass shade, ' +
      'two warm glowing bulbs casting soft light upward, polished brass mounting plate, ' +
      'classic movie theatre lobby fixture, photorealistic 3D render, ' +
      'single isolated object on transparent background',
  },

  // ── HealingVRRoom ───────────────────────────────────────────
  zen_rock_garden: {
    prompt:
      'a Japanese zen rock garden composition with five smoothed grey stones of varying heights ' +
      'arranged on raked light sand, serene minimal aesthetic, photorealistic 3D render, ' +
      'single composition, isolated on transparent background',
  },
  cushion_zafu: {
    prompt:
      'a round deep burgundy meditation cushion zafu with gold trim, ' +
      'minimalist zen style, photorealistic 3D render, single isolated object',
  },
  bamboo_pot: {
    prompt:
      'tall lucky bamboo stalks in a brown clay pot, several green stalks, ' +
      'zen interior decor, photorealistic 3D render, single isolated object',
  },
  bonsai_tree: {
    prompt:
      'a Japanese bonsai tree in a glazed ceramic pot, twisted aged trunk, lush green canopy, ' +
      'serene zen aesthetic, photorealistic studio render, single isolated object',
  },
  tsukubai: {
    prompt:
      'a Japanese stone water basin tsukubai with a bamboo spout dripping water, mossy stone, ' +
      'zen garden ornament, photorealistic 3D render, single isolated object',
  },

  // ── GamesVRRoom ─────────────────────────────────────────────
  pedestal_table_walnut: {
    prompt:
      'a small round wooden pedestal game table with a single thick centre leg, ' +
      'polished walnut top, classic style, photorealistic 3D render, single isolated object',
  },
  chair_blue: {
    prompt:
      'a vibrant blue cushioned dining chair with curved wooden legs, ' +
      'modern simple style, photorealistic 3D render, single isolated object',
  },
  arcade_blue: {
    prompt:
      'a retro 1980s vertical arcade cabinet, neon blue side art, glowing CRT screen with pixel game, ' +
      'red joystick and four buttons, marquee on top, photorealistic 3D render, single isolated object',
  },
  arcade_pink: {
    prompt:
      'a retro 1980s vertical arcade cabinet, neon pink and orange side art, ' +
      'glowing CRT screen with pixel fighting game, yellow joystick and six buttons, ' +
      'marquee on top, photorealistic 3D render, single isolated object',
  },
  bean_bag: {
    prompt:
      'a soft round fabric bean bag chair, vibrant colours, lounge floor seat, ' +
      'photorealistic 3D render, single isolated object',
  },
  pinball_machine: {
    prompt:
      'a vintage retro pinball arcade machine, glowing colourful playfield under glass, ' +
      'two red flippers, a tall backglass with neon star and rocket artwork and bright bulbs, ' +
      'side flipper buttons, polished black wood cabinet with chrome trim, ' +
      'classic 1980s arcade game-room piece, front-facing, ' +
      'photorealistic 3D render, single isolated object',
  },
  dartboard_cabinet: {
    prompt:
      'a classic wooden dartboard cabinet with both doors open, a tournament dartboard inside, ' +
      'six steel-tip darts tucked into the inner doors, a small chalk scoreboard on one door, ' +
      'rich walnut wood frame with brass hinges, pub game-room wall decor, ' +
      'photorealistic 3D render, single isolated object',
  },
  neon_game_sign: {
    prompt:
      'a glowing neon sign that reads GAME ON in bold pink and cyan glass tubing, ' +
      'small star accents on the sides, mounted on a thin dark backing plate, ' +
      '1980s arcade aesthetic, bright soft glow, wall art, ' +
      'photorealistic 3D render, single isolated object on transparent background',
  },
  vending_machine_snacks: {
    prompt:
      'a retro snack and soda vending machine, transparent front window with colourful ' +
      'packaged snacks and bottled drinks visible inside, glowing top sign, ' +
      'red and cream painted metal cabinet, push-button keypad and coin slot, ' +
      'classic game-room appliance, front-facing, photorealistic 3D render, single isolated object',
  },
  trophy_shelf: {
    prompt:
      'a small wooden display shelf with three golden trophy cups of varying sizes on top, ' +
      'a couple of colourful gaming medals hanging from hooks below, dark walnut frame, ' +
      'celebratory game-room decor, photorealistic 3D render, single composition, ' +
      'isolated on transparent background',
  },

  // ── Hub / Lobby curated decorations ───────────────────────
  // Replace the old plant_tropical (felt out of place in a marble lobby)
  // with a pair of more refined, hotel-lobby-grade fixtures.
  marble_urn_vase: {
    prompt:
      'a tall ornate ivory marble pedestal urn vase filled with an elegant ' +
      'bouquet of white roses and eucalyptus, classical fluted base with ' +
      'soft gold trim, hotel lobby decoration, photorealistic 3D render, ' +
      'single isolated object on transparent background',
  },
  art_deco_floor_lamp: {
    prompt:
      'an elegant art deco brass floor lamp with a pleated cream silk shade ' +
      'glowing warm amber, slender fluted column, weighted round base, ' +
      'classic luxury hotel lobby fixture, photorealistic 3D render, ' +
      'single isolated object on transparent background',
  },

  // ── AI companion (chat zone) ──────────────────────────────
  companion_mascot: {
    prompt:
      'a chubby cute glowing pastel-coral fluffy mascot orb with two big sparkling eyes, ' +
      'soft round body, two tiny stubby arms, friendly smiling face, cartoon stylized, ' +
      'warm soft lighting, clean front-facing pose, low-poly stylized 3D character, no background',
  },
}
