export type Recipe = {
  name: string;
  emoji: string;
  time: string;
  difficulty: "Super Easy" | "Easy" | "A Little Tricky";
  servings: string;
  ingredients: string[];
  steps: string[];
  tip: string;
  isGeneric?: boolean;
  image?: string;
  youtubeVideo?: string;
  source?: string;
  sourceUrl?: string;
  // Set when the user picks a famous chef in AI Top-Chef mode. The in-app
  // recipe is only "inspired by" that chef — these URLs are searches for the
  // dish on the chef's own official website / YouTube channel.
  chefName?: string;
  chefCountry?: string;
  chefWebsiteSearchUrl?: string;
  chefYouTubeSearchUrl?: string;
};

export const recipeBook: Record<string, Recipe> = {
  pancake: {
    name: "Fluffy Pancakes",
    emoji: "🥞",
    time: "20 minutes",
    difficulty: "Easy",
    servings: "4 pancakes",
    ingredients: [
      "1 cup all-purpose flour",
      "2 tablespoons sugar",
      "1 teaspoon baking powder",
      "1/2 teaspoon salt",
      "1 cup milk",
      "1 egg",
      "2 tablespoons melted butter",
      "Butter or oil for the pan",
      "Maple syrup & berries (for topping)",
    ],
    steps: [
      "Ask a grown-up to help you get all the ingredients on the counter.",
      "In a big bowl, mix the flour, sugar, baking powder, and salt with a spoon.",
      "In another bowl, whisk the milk, egg, and melted butter together.",
      "Pour the wet mix into the dry mix and stir gently until just combined. A few lumps are okay!",
      "Ask a grown-up to heat a pan on medium and add a little butter.",
      "Scoop about 1/4 cup of batter onto the pan for each pancake.",
      "When you see bubbles on top (about 2 minutes), flip with a spatula!",
      "Cook the other side for 1–2 minutes until golden brown.",
      "Stack them up, add syrup and berries, and enjoy your yummy pancakes!",
    ],
    tip: "Don't overmix the batter — lumpy batter makes fluffier pancakes!",
  },
  pizza: {
    name: "Mini Personal Pizza",
    emoji: "🍕",
    time: "25 minutes",
    difficulty: "Easy",
    servings: "1 pizza",
    ingredients: [
      "1 pita bread, tortilla, or English muffin",
      "3 tablespoons pizza sauce or tomato sauce",
      "1/2 cup shredded mozzarella cheese",
      "Your favorite toppings (pepperoni, peppers, mushrooms, olives)",
      "A pinch of dried oregano or Italian seasoning",
      "Olive oil (optional)",
    ],
    steps: [
      "Wash your hands and put on an apron if you have one!",
      "Ask a grown-up to preheat the oven to 400°F (200°C).",
      "Place your pita, tortilla, or muffin on a baking sheet.",
      "Spread the pizza sauce all over the top with a spoon.",
      "Sprinkle lots of cheese on top of the sauce.",
      "Add your favorite toppings — get creative!",
      "Sprinkle a tiny bit of oregano on top.",
      "Ask a grown-up to put it in the oven for 8–12 minutes until the cheese is melty and bubbly.",
      "Let it cool for 2 minutes, then slice and munch!",
    ],
    tip: "Less is more with toppings — too many can make the pizza soggy.",
  },
  sandwich: {
    name: "Super Hero Sandwich",
    emoji: "🥪",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 sandwich",
    ingredients: [
      "2 slices of bread",
      "2 tablespoons peanut butter, hummus, or mayo",
      "2 slices of cheese or deli meat (optional)",
      "Lettuce leaves",
      "Tomato slices",
      "Cucumber slices",
      "Any other veggies you love!",
    ],
    steps: [
      "Wash your hands with soap and water.",
      "Lay out 2 slices of bread on a clean plate.",
      "Spread peanut butter, hummus, or mayo on one or both slices.",
      "Add cheese or meat if you want.",
      "Layer on lettuce, tomato, and cucumber.",
      "Put the second slice of bread on top and gently press down.",
      "Ask a grown-up to help you cut it in half — diagonal cuts look extra cool!",
      "Serve with fruit or chips on the side. Super hero fuel!",
    ],
    tip: "Toast the bread first for extra crunch!",
  },
  cookies: {
    name: "Chocolate Chip Cookies",
    emoji: "🍪",
    time: "30 minutes",
    difficulty: "Easy",
    servings: "12 cookies",
    ingredients: [
      "1/2 cup soft butter",
      "1/2 cup brown sugar",
      "1/4 cup white sugar",
      "1 egg",
      "1 teaspoon vanilla extract",
      "1 1/2 cups all-purpose flour",
      "1/2 teaspoon baking soda",
      "1/4 teaspoon salt",
      "1 cup chocolate chips",
    ],
    steps: [
      "Ask a grown-up to preheat the oven to 350°F (175°C).",
      "In a big bowl, mix the soft butter and both sugars until creamy.",
      "Crack in the egg and add vanilla. Mix well!",
      "Add the flour, baking soda, and salt. Stir until a dough forms.",
      "Pour in the chocolate chips and mix them in with your (clean!) hands or a spoon.",
      "Scoop spoonfuls of dough onto a baking sheet, leaving space between each.",
      "Ask a grown-up to bake them for 10–12 minutes until the edges are golden.",
      "Let them cool on the tray for 5 minutes — they firm up as they cool.",
      "Grab a glass of milk and enjoy warm cookies!",
    ],
    tip: "Chill the dough for 10 minutes if it feels too sticky to scoop.",
  },
  smoothie: {
    name: "Rainbow Fruit Smoothie",
    emoji: "🥤",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "2 glasses",
    ingredients: [
      "1 banana",
      "1 cup frozen berries (strawberries, blueberries, or mixed)",
      "1/2 cup yogurt (plain or vanilla)",
      "1/2 cup milk or juice",
      "1 teaspoon honey (optional)",
      "A handful of spinach (secret superpower boost!)",
    ],
    steps: [
      "Wash your hands and gather all your fruit.",
      "Peel the banana and break it into chunks.",
      "Put the banana, frozen berries, yogurt, and milk into a blender.",
      "Add honey and spinach if you want — you won't even taste the spinach!",
      "Ask a grown-up to help blend until smooth and creamy.",
      "Pour into two fun glasses or cups.",
      "Add a straw and maybe a berry on top for decoration.",
      "Sip and feel the rainbow power!",
    ],
    tip: "Frozen fruit makes the smoothie thick and cold — no ice needed!",
  },
  pasta: {
    name: "Buttery Parmesan Pasta",
    emoji: "🍝",
    time: "20 minutes",
    difficulty: "Easy",
    servings: "2 bowls",
    ingredients: [
      "2 cups pasta (any shape you like!)",
      "2 tablespoons butter",
      "1/4 cup grated Parmesan cheese",
      "A pinch of salt",
      "A pinch of black pepper",
      "1 tablespoon chopped parsley (optional)",
      "Cherry tomatoes (optional)",
    ],
    steps: [
      "Ask a grown-up to boil a big pot of water with a pinch of salt.",
      "Carefully add the pasta when the water is bubbling.",
      "Cook according to the package (usually 8–12 minutes). Stir once or twice.",
      "Ask a grown-up to drain the pasta, saving a tiny splash of pasta water.",
      "Put the hot pasta back in the pot (off the heat).",
      "Add butter and stir until it melts all over the noodles.",
      "Sprinkle in the Parmesan cheese and mix until creamy.",
      "Add a splash of pasta water if it looks dry. Season with salt and pepper.",
      "Scoop into bowls, top with parsley or tomatoes, and dig in!",
    ],
    tip: "Any pasta shape works — bowties and shells are extra fun!",
  },
  eggs: {
    name: "Cheesy Scrambled Eggs",
    emoji: "🍳",
    time: "10 minutes",
    difficulty: "Easy",
    servings: "1 plate",
    ingredients: [
      "2 eggs",
      "1 tablespoon milk",
      "1 tablespoon butter",
      "2 tablespoons shredded cheese",
      "A pinch of salt",
      "Toast or fruit on the side (optional)",
    ],
    steps: [
      "Crack the eggs into a bowl. Fish out any shell pieces!",
      "Add the milk and a pinch of salt. Whisk with a fork until frothy.",
      "Ask a grown-up to melt butter in a pan on low-medium heat.",
      "Pour in the eggs. Let them sit for a few seconds.",
      "Gently push the eggs around the pan with a spatula — slow and steady!",
      "When the eggs are almost done (still a little shiny), sprinkle on the cheese.",
      "Stir once more until the cheese melts, then take off the heat.",
      "Serve on a plate with toast. Breakfast champion!",
    ],
    tip: "Low heat makes softer, creamier eggs. Don't rush!",
  },
  taco: {
    name: "Build-Your-Own Tacos",
    emoji: "🌮",
    time: "25 minutes",
    difficulty: "Easy",
    servings: "3 tacos",
    ingredients: [
      "3 soft tortillas or hard taco shells",
      "1 cup cooked ground meat, beans, or shredded chicken",
      "1/2 cup shredded cheese",
      "1/2 cup shredded lettuce",
      "1 diced tomato",
      "2 tablespoons sour cream or guacamole",
      "Salsa (mild!)",
    ],
    steps: [
      "Wash your hands and set up a taco station with all toppings in little bowls.",
      "Ask a grown-up to warm the tortillas or heat the filling.",
      "Place a tortilla on your plate.",
      "Spoon some meat, beans, or chicken down the middle.",
      "Sprinkle cheese on while the filling is warm so it melts.",
      "Add lettuce, tomato, and a dollop of sour cream or guac.",
      "Add a little salsa if you like it zesty.",
      "Fold and take a big bite — hold with both hands!",
      "Make another one with different toppings!",
    ],
    tip: "Set up a topping bar so everyone can build their own perfect taco.",
  },
  muffins: {
    name: "Blueberry Muffins",
    emoji: "🧁",
    time: "35 minutes",
    difficulty: "Easy",
    servings: "8 muffins",
    ingredients: [
      "1 1/2 cups all-purpose flour",
      "1/2 cup sugar",
      "2 teaspoons baking powder",
      "1/4 teaspoon salt",
      "1/3 cup oil or melted butter",
      "1 egg",
      "1/2 cup milk",
      "1 teaspoon vanilla",
      "1 cup fresh or frozen blueberries",
    ],
    steps: [
      "Ask a grown-up to preheat the oven to 375°F (190°C) and line a muffin tin.",
      "In a big bowl, mix flour, sugar, baking powder, and salt.",
      "In another bowl, whisk oil, egg, milk, and vanilla.",
      "Pour wet ingredients into dry and stir just until combined.",
      "Gently fold in the blueberries.",
      "Spoon the batter into muffin cups, filling each about 2/3 full.",
      "Ask a grown-up to bake for 18–22 minutes until a toothpick comes out clean.",
      "Cool for 10 minutes, then enjoy a warm muffin!",
    ],
    tip: "Toss blueberries in a tiny bit of flour so they don't sink to the bottom.",
  },
  nachos: {
    name: "Loaded Nachos",
    emoji: "🧀",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "2–3 friends",
    ingredients: [
      "1 bag tortilla chips",
      "1 1/2 cups shredded cheese",
      "1/2 cup black beans or corn",
      "1 diced tomato",
      "2 tablespoons sliced jalapeños (optional, ask first!)",
      "Sour cream and salsa for dipping",
      "Chopped green onions (optional)",
    ],
    steps: [
      "Ask a grown-up to preheat the oven to 375°F (190°C).",
      "Spread tortilla chips in a single layer on a baking sheet.",
      "Sprinkle cheese all over the chips — don't be shy!",
      "Add beans or corn on top.",
      "Ask a grown-up to bake for 8–10 minutes until the cheese is melted.",
      "Carefully remove from the oven (grown-up job!).",
      "Top with tomato, green onions, and jalapeños if you dare.",
      "Serve with sour cream and salsa. Share with friends!",
    ],
    tip: "Use two kinds of cheese for extra gooey goodness.",
  },
  oatmeal: {
    name: "Cozy Cinnamon Oatmeal",
    emoji: "🥣",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 bowl",
    ingredients: [
      "1/2 cup rolled oats",
      "1 cup milk or water",
      "1 teaspoon honey or maple syrup",
      "1/4 teaspoon cinnamon",
      "A handful of berries or sliced banana",
      "A sprinkle of nuts or granola (optional)",
    ],
    steps: [
      "Ask a grown-up to help heat the milk or water in a small pot.",
      "When it starts to bubble gently, stir in the oats.",
      "Cook on low for 3–5 minutes, stirring often, until creamy.",
      "Take off the heat and stir in honey and cinnamon.",
      "Pour into your favorite bowl.",
      "Top with berries, banana, and granola.",
      "Blow on it if it's hot, then enjoy a cozy breakfast!",
    ],
    tip: "Make it overnight: mix oats + milk in a jar, fridge overnight, eat cold!",
  },
  hotchocolate: {
    name: "Creamy Hot Chocolate",
    emoji: "☕",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 mug",
    ingredients: [
      "1 cup milk",
      "2 tablespoons cocoa powder",
      "1–2 tablespoons sugar",
      "A tiny pinch of salt",
      "1/4 teaspoon vanilla extract",
      "Mini marshmallows",
      "Whipped cream (optional)",
    ],
    steps: [
      "Ask a grown-up to warm the milk in a small pot on low heat (don't boil!).",
      "In your mug, mix cocoa powder, sugar, and a pinch of salt.",
      "Add a tiny splash of warm milk to the mug and stir into a smooth paste.",
      "Pour in the rest of the warm milk and stir well.",
      "Add vanilla and stir again.",
      "Top with lots of mini marshmallows and whipped cream.",
      "Hold the mug with both hands, sip slowly, and feel the cozy vibes!",
    ],
    tip: "A candy cane stirrer makes it minty and festive!",
  },
  fruit: {
    name: "Rainbow Fruit Kabobs",
    emoji: "🌈",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "6 kabobs",
    ingredients: [
      "Strawberries",
      "Orange slices or cantaloupe",
      "Pineapple chunks",
      "Green grapes or kiwi",
      "Blueberries",
      "Purple grapes",
      "Wooden skewers",
      "Yogurt for dipping (optional)",
    ],
    steps: [
      "Wash all the fruit really well.",
      "Ask a grown-up to help cut bigger fruit into bite-size pieces.",
      "Lay out the fruit in rainbow order: red, orange, yellow, green, blue, purple.",
      "Carefully slide fruit onto each skewer in rainbow order.",
      "Fill 5–6 skewers — leave a little room at the bottom to hold them.",
      "Arrange them on a plate like a rainbow fan.",
      "Mix a little honey into yogurt for a yummy dip.",
      "Take a photo, then chomp away!",
    ],
    tip: "These are perfect for parties and look amazing on a platter.",
  },
  quesadilla: {
    name: "Cheesy Quesadilla",
    emoji: "🫓",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 quesadilla",
    ingredients: [
      "2 flour tortillas",
      "1/2 cup shredded cheese",
      "Optional fillings: beans, corn, cooked chicken, spinach",
      "Salsa or guacamole for dipping",
      "A little butter or oil",
    ],
    steps: [
      "Sprinkle cheese on one tortilla.",
      "Add any extra fillings you like.",
      "Put the second tortilla on top like a lid.",
      "Ask a grown-up to heat a pan and cook the quesadilla 2–3 minutes per side until golden and melty.",
      "Let it cool for a minute so the cheese isn't lava-hot.",
      "Ask a grown-up to slice it into triangles like a pizza.",
      "Dip in salsa or guac and enjoy!",
    ],
    tip: "Press gently with a spatula while cooking so it sticks together.",
  },
  popcorn: {
    name: "Movie Night Popcorn",
    emoji: "🍿",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 big bowl",
    ingredients: [
      "1/3 cup popcorn kernels (or 1 microwave popcorn bag)",
      "2 tablespoons butter",
      "1/4 teaspoon salt",
      "Optional toppings: Parmesan, cinnamon sugar, or nutritional yeast",
    ],
    steps: [
      "If using microwave popcorn, ask a grown-up to follow the bag instructions.",
      "For stove popcorn: ask a grown-up to heat oil in a big pot with a lid.",
      "Add kernels, cover, and shake the pot gently over the heat.",
      "When popping slows down, take it off the heat.",
      "Ask a grown-up to melt the butter.",
      "Pour popcorn into a big bowl, drizzle butter, and sprinkle salt.",
      "Toss and add fun toppings if you want.",
      "Start the movie and dig in!",
    ],
    tip: "Make two bowls with different toppings for a popcorn bar!",
  },
  banana: {
    name: "Frozen Banana Pops",
    emoji: "🍌",
    time: "15 minutes + freeze time",
    difficulty: "Super Easy",
    servings: "4 pops",
    ingredients: [
      "2 ripe bananas",
      "1 cup chocolate chips",
      "1 teaspoon oil (for melting chocolate)",
      "Toppings: sprinkles, crushed nuts, coconut",
      "4 popsicle sticks or skewers",
    ],
    steps: [
      "Peel the bananas and cut each in half (you get 4 pieces).",
      "Push a popsicle stick into the cut end of each banana half.",
      "Ask a grown-up to melt the chocolate chips with a little oil.",
      "Dip each banana into the chocolate or spoon chocolate over it.",
      "Quickly add sprinkles or toppings before the chocolate hardens.",
      "Place on a parchment-lined plate.",
      "Freeze for at least 1 hour until firm.",
      "Enjoy your icy, chocolatey banana pops!",
    ],
    tip: "Work fast with toppings — chocolate sets quickly on cold bananas!",
  },
  rice: {
    name: "Easy Fried Rice",
    emoji: "🍚",
    time: "20 minutes",
    difficulty: "A Little Tricky",
    servings: "2 bowls",
    ingredients: [
      "2 cups cooked cold rice (day-old is best!)",
      "2 eggs",
      "1/2 cup frozen peas and carrots",
      "2 green onions, sliced",
      "2 tablespoons soy sauce",
      "1 tablespoon oil",
      "A pinch of garlic powder",
    ],
    steps: [
      "Ask a grown-up to heat oil in a big pan or wok.",
      "Crack the eggs into the pan and scramble them. Set aside on a plate.",
      "Add a bit more oil, then the peas and carrots. Stir for 2–3 minutes.",
      "Add the cold rice and break up any clumps with your spoon.",
      "Ask a grown-up to help stir-fry for 3–4 minutes.",
      "Add soy sauce and garlic powder. Mix well!",
      "Stir the scrambled eggs back in.",
      "Top with green onions and serve hot!",
    ],
    tip: "Cold leftover rice works way better than fresh warm rice.",
  },
  salad: {
    name: "Crunchy Rainbow Salad",
    emoji: "🥗",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "2 bowls",
    ingredients: [
      "2 cups lettuce or mixed greens",
      "1/2 cup cherry tomatoes, halved",
      "1/2 cucumber, sliced",
      "1/4 cup shredded carrots",
      "1/4 cup corn",
      "1/4 cup cheese cubes or croutons",
      "Your favorite dressing",
    ],
    steps: [
      "Wash all the veggies really well.",
      "Tear the lettuce into bite-size pieces and put in a big bowl.",
      "Add tomatoes, cucumber, carrots, and corn.",
      "Toss everything gently with clean hands or salad tongs.",
      "Add cheese cubes or croutons on top.",
      "Drizzle with dressing right before eating.",
      "Toss once more and serve. Crunch crunch!",
    ],
    tip: "Keep dressing on the side so leftovers stay crispy.",
  },
  mac: {
    name: "Creamy Mac and Cheese",
    emoji: "🧀",
    time: "25 minutes",
    difficulty: "Easy",
    servings: "3 bowls",
    ingredients: [
      "2 cups elbow macaroni",
      "2 tablespoons butter",
      "2 tablespoons flour",
      "1 1/2 cups milk",
      "1 1/2 cups shredded cheddar cheese",
      "A pinch of salt",
      "A pinch of garlic powder (optional)",
    ],
    steps: [
      "Ask a grown-up to cook the macaroni in boiling water until tender, then drain.",
      "In the same pot (low heat), melt the butter.",
      "Whisk in the flour and cook for 1 minute — it will look pasty.",
      "Slowly pour in the milk while whisking so it stays smooth.",
      "Cook until the sauce thickens a little (2–3 minutes).",
      "Turn off the heat and stir in the cheese until melty and smooth.",
      "Add the cooked pasta and stir to coat every noodle.",
      "Taste and add a pinch of salt. Serve in your coziest bowl!",
    ],
    tip: "Take the pot off the heat before adding cheese so it stays silky.",
  },
  waffle: {
    name: "Wonderful Waffles",
    emoji: "🧇",
    time: "25 minutes",
    difficulty: "Easy",
    servings: "4 waffles",
    ingredients: [
      "1 cup all-purpose flour",
      "1 tablespoon sugar",
      "1 teaspoon baking powder",
      "1/4 teaspoon salt",
      "1 cup milk",
      "1 egg",
      "2 tablespoons melted butter",
      "Toppings: syrup, fruit, whipped cream",
    ],
    steps: [
      "Ask a grown-up to preheat the waffle iron.",
      "Mix flour, sugar, baking powder, and salt in a bowl.",
      "In another bowl, whisk milk, egg, and melted butter.",
      "Combine wet and dry ingredients. Stir until just mixed.",
      "Ask a grown-up to spray or butter the waffle iron.",
      "Pour batter onto the iron (don't overfill!) and close the lid.",
      "Cook until golden and steamy stops coming out (about 3–5 minutes).",
      "Top with syrup, berries, and whipped cream. Breakfast win!",
    ],
    tip: "Don't open the waffle iron too early or the waffle might tear.",
  },
  soup: {
    name: "Cozy Tomato Soup",
    emoji: "🍅",
    time: "20 minutes",
    difficulty: "Easy",
    servings: "3 bowls",
    ingredients: [
      "1 can (28 oz) crushed tomatoes",
      "1 cup vegetable or chicken broth",
      "1/2 cup milk or cream",
      "1 tablespoon butter",
      "1/2 teaspoon sugar",
      "A pinch of salt and pepper",
      "Grilled cheese for dunking!",
    ],
    steps: [
      "Ask a grown-up to melt butter in a pot on medium heat.",
      "Pour in the crushed tomatoes and broth. Stir well.",
      "Add sugar, salt, and pepper.",
      "Let it simmer gently for 10 minutes (small bubbles, not crazy boiling).",
      "Ask a grown-up to carefully blend with an immersion blender, or mash with a potato masher.",
      "Stir in the milk or cream.",
      "Taste and adjust seasoning.",
      "Ladle into bowls and serve with grilled cheese dippers!",
    ],
    tip: "A tiny pinch of sugar balances the tomatoes' tanginess.",
  },
  toast: {
    name: "Awesome Avocado Toast",
    emoji: "🥑",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "2 toasts",
    ingredients: [
      "2 slices of bread",
      "1 ripe avocado",
      "A pinch of salt",
      "A squeeze of lemon or lime",
      "Optional toppings: cherry tomatoes, egg, everything bagel seasoning, cheese",
    ],
    steps: [
      "Toast the bread until golden and crispy.",
      "Ask a grown-up to help cut the avocado in half and remove the pit.",
      "Scoop the avocado into a bowl.",
      "Mash with a fork until mostly smooth (a few chunks are nice!).",
      "Add a pinch of salt and a squeeze of lemon. Mix.",
      "Spread thickly on your toast.",
      "Add any fun toppings you like.",
      "Eat right away while the toast is still crunchy!",
    ],
    tip: "A ripe avocado feels slightly soft when you gently squeeze it.",
  },
  brownie: {
    name: "Fudgy Brownies",
    emoji: "🍫",
    time: "40 minutes",
    difficulty: "Easy",
    servings: "9 brownies",
    ingredients: [
      "1/2 cup butter",
      "1 cup sugar",
      "2 eggs",
      "1 teaspoon vanilla",
      "1/3 cup cocoa powder",
      "1/2 cup flour",
      "1/4 teaspoon salt",
      "1/4 teaspoon baking powder",
      "Extra chocolate chips (optional)",
    ],
    steps: [
      "Ask a grown-up to preheat the oven to 350°F (175°C) and grease an 8x8 pan.",
      "Ask a grown-up to melt the butter, then let it cool a little.",
      "Mix melted butter, sugar, eggs, and vanilla in a bowl.",
      "Add cocoa, flour, salt, and baking powder. Stir until smooth.",
      "Fold in chocolate chips if using.",
      "Pour into the pan and spread evenly.",
      "Ask a grown-up to bake 20–25 minutes. A toothpick should come out with a few crumbs.",
      "Cool before cutting into squares. Gooey chocolate heaven!",
    ],
    tip: "Don't overbake — slightly underdone centers make fudgier brownies.",
  },
  wrap: {
    name: "Turkey Ranch Wrap",
    emoji: "🌯",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 wrap",
    ingredients: [
      "1 large tortilla or wrap",
      "2–3 slices turkey or ham",
      "1 slice cheese",
      "Lettuce leaves",
      "Tomato slices",
      "1 tablespoon ranch dressing or mayo",
      "Shredded carrots (optional)",
    ],
    steps: [
      "Lay the tortilla flat on a clean plate.",
      "Spread ranch or mayo in the center.",
      "Layer turkey, cheese, lettuce, tomato, and carrots.",
      "Don't overfill or it will be hard to roll!",
      "Fold in the left and right sides, then roll tightly from the bottom.",
      "Ask a grown-up to slice it in half on a diagonal.",
      "Pack it for lunch or eat it right away!",
    ],
    tip: "Warm the tortilla for 10 seconds so it rolls without cracking.",
  },
  yogurt: {
    name: "Yogurt Parfait Party",
    emoji: "🥄",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "1 tall glass",
    ingredients: [
      "1 cup yogurt (vanilla or plain)",
      "1/2 cup granola",
      "1/2 cup mixed berries or chopped fruit",
      "1 teaspoon honey",
      "Optional: mini chocolate chips or coconut flakes",
    ],
    steps: [
      "Grab a clear glass so you can see the pretty layers!",
      "Spoon a layer of yogurt into the bottom.",
      "Add a layer of granola.",
      "Add a layer of berries.",
      "Repeat the layers until the glass is full.",
      "Drizzle honey on top.",
      "Add a few chocolate chips or coconut if you want.",
      "Grab a long spoon and enjoy your masterpiece!",
    ],
    tip: "Add granola right before eating so it stays crunchy.",
  },
  grilledcheese: {
    name: "Gooey Grilled Cheese",
    emoji: "🧀",
    time: "10 minutes",
    difficulty: "Easy",
    servings: "1 sandwich",
    ingredients: [
      "2 slices of bread",
      "2 slices of cheese (cheddar, American, or your fave)",
      "1 tablespoon butter",
    ],
    steps: [
      "Butter one side of each bread slice.",
      "Place one slice butter-side-down in a cold pan.",
      "Add the cheese on top of the bread.",
      "Put the second slice on top, butter-side-up.",
      "Ask a grown-up to cook on medium-low for 3–4 minutes until golden.",
      "Flip carefully with a spatula and cook the other side.",
      "When both sides are golden and cheese is melted, remove from pan.",
      "Let it cool 1 minute, slice, and dunk in tomato soup if you have it!",
    ],
    tip: "Low and slow heat melts the cheese without burning the bread.",
  },
  apples: {
    name: "Cinnamon Apple Nachos",
    emoji: "🍎",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "2 plates",
    ingredients: [
      "2 apples",
      "2 tablespoons peanut butter or almond butter",
      "1 teaspoon honey",
      "A sprinkle of cinnamon",
      "2 tablespoons granola",
      "Mini chocolate chips or raisins",
    ],
    steps: [
      "Wash the apples.",
      "Ask a grown-up to help slice the apples into thin rounds or wedges.",
      "Arrange the apple slices on a plate like nachos.",
      "Ask a grown-up to warm the peanut butter for 15 seconds so it drizzles.",
      "Drizzle peanut butter and honey over the apples.",
      "Sprinkle cinnamon, granola, and chocolate chips on top.",
      "Share with a friend and munch!",
    ],
    tip: "A squeeze of lemon on the apples keeps them from turning brown.",
  },
  lemonade: {
    name: "Fresh Squeezed Lemonade",
    emoji: "🍋",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "4 glasses",
    ingredients: [
      "4–5 fresh lemons",
      "1/2 cup sugar (or to taste)",
      "4 cups cold water",
      "Ice cubes",
      "Lemon slices and mint for garnish",
    ],
    steps: [
      "Ask a grown-up to help cut the lemons in half.",
      "Squeeze the lemons into a pitcher (use a juicer if you have one!).",
      "You want about 1 cup of lemon juice. Remove any seeds.",
      "Add the sugar and 1 cup of water. Stir until sugar dissolves.",
      "Pour in the remaining 3 cups of cold water. Stir well.",
      "Taste it — add more sugar if you want it sweeter!",
      "Fill glasses with ice and pour the lemonade.",
      "Add a lemon slice and mint leaf. Refreshing!",
    ],
    tip: "Roll lemons on the counter before cutting — they give more juice!",
  },
  sushi: {
    name: "Kid-Friendly Sushi Rolls",
    emoji: "🍣",
    time: "30 minutes",
    difficulty: "A Little Tricky",
    servings: "4 rolls",
    ingredients: [
      "2 cups cooked sushi rice (or short-grain rice), cooled",
      "1 tablespoon rice vinegar mixed with 1 tsp sugar",
      "4 sheets nori (seaweed) or use tortillas for easy version",
      "Cucumber sticks",
      "Avocado slices",
      "Cream cheese strips",
      "Cooked shrimp or crab sticks (optional)",
      "Soy sauce for dipping",
    ],
    steps: [
      "Mix the cooled rice with the vinegar-sugar mix. It should be sticky.",
      "Place a nori sheet (or tortilla) on a clean cutting board.",
      "With wet fingers, spread a thin layer of rice over most of the sheet, leaving a strip empty at the top.",
      "Lay cucumber, avocado, cream cheese, and shrimp in a line near the bottom.",
      "Roll tightly from the bottom, using the empty strip to seal.",
      "Ask a grown-up to slice into bite-size pieces with a sharp wet knife.",
      "Arrange on a plate and serve with soy sauce.",
      "You made sushi — how cool is that?!",
    ],
    tip: "Wet hands keep the rice from sticking to your fingers.",
  },
  icecream: {
    name: "No-Churn Ice Cream Cups",
    emoji: "🍦",
    time: "15 minutes + freeze",
    difficulty: "Easy",
    servings: "4 cups",
    ingredients: [
      "1 cup heavy cream",
      "1/2 can (7 oz) sweetened condensed milk",
      "1 teaspoon vanilla",
      "Mix-ins: crushed cookies, sprinkles, chocolate chips, fruit",
    ],
    steps: [
      "Ask a grown-up to help whip the heavy cream until it makes soft peaks.",
      "Gently fold in the sweetened condensed milk and vanilla.",
      "Add your favorite mix-ins!",
      "Spoon into small cups or a loaf pan.",
      "Freeze for at least 4 hours until firm.",
      "Scoop or eat straight from the cup.",
      "Top with more sprinkles because why not?!",
    ],
    tip: "Don't overmix when folding — keep it light and airy!",
  },
  chicken: {
    name: "Crispy Baked Chicken Tenders",
    emoji: "🍗",
    time: "35 minutes",
    difficulty: "Easy",
    servings: "3–4 kids",
    ingredients: [
      "1 pound chicken tenders or chicken breast strips",
      "1 cup breadcrumbs or crushed cornflakes",
      "1/2 cup grated Parmesan",
      "1 teaspoon garlic powder",
      "1/2 teaspoon paprika",
      "2 eggs",
      "Cooking spray or oil",
      "Dipping sauces: ketchup, honey mustard, BBQ",
    ],
    steps: [
      "Ask a grown-up to preheat the oven to 400°F (200°C) and line a baking sheet.",
      "Mix breadcrumbs, Parmesan, garlic powder, and paprika in a shallow bowl.",
      "Beat the eggs in another bowl.",
      "Dip each chicken strip in egg, then coat in the breadcrumb mix.",
      "Place on the baking sheet and spray lightly with oil.",
      "Ask a grown-up to bake 15–20 minutes until golden and cooked through.",
      "Let cool a few minutes, then serve with your favorite dips!",
      "Crunchy outside, juicy inside — high five!",
    ],
    tip: "Crushed cornflakes make them extra crispy and fun!",
  },
  cupcake: {
    name: "Vanilla Cupcakes",
    emoji: "🧁",
    time: "40 minutes",
    difficulty: "Easy",
    servings: "12 cupcakes",
    ingredients: [
      "1 1/2 cups flour",
      "1 cup sugar",
      "1 1/2 teaspoons baking powder",
      "1/2 teaspoon salt",
      "1/2 cup butter, soft",
      "2 eggs",
      "1/2 cup milk",
      "2 teaspoons vanilla",
      "Frosting and sprinkles for decorating!",
    ],
    steps: [
      "Ask a grown-up to preheat oven to 350°F (175°C) and line a cupcake pan.",
      "Mix flour, sugar, baking powder, and salt in a big bowl.",
      "Add soft butter, eggs, milk, and vanilla.",
      "Mix until smooth and creamy.",
      "Fill each cupcake liner about 2/3 full.",
      "Ask a grown-up to bake 18–20 minutes until a toothpick comes out clean.",
      "Cool completely before frosting.",
      "Frost, add sprinkles, and make them look amazing!",
    ],
    tip: "Cool cupcakes fully before frosting or the frosting will melt.",
  },
  burrito: {
    name: "Bean & Cheese Burrito",
    emoji: "🌯",
    time: "15 minutes",
    difficulty: "Easy",
    servings: "2 burritos",
    ingredients: [
      "2 large flour tortillas",
      "1 cup refried beans or black beans",
      "1 cup shredded cheese",
      "1/4 cup salsa",
      "Optional: rice, sour cream, lettuce, guacamole",
    ],
    steps: [
      "Ask a grown-up to warm the beans in a microwave or pot.",
      "Warm the tortillas so they bend easily.",
      "Spread beans down the center of each tortilla.",
      "Add cheese, salsa, and any extras.",
      "Fold the sides in, then roll tightly from the bottom.",
      "Optional: ask a grown-up to crisp it in a pan for 2 minutes per side.",
      "Slice in half and serve!",
    ],
    tip: "Don't overfill — a snug roll holds together better.",
  },
  pancakes_special: {
    name: "Banana Pancake Bites",
    emoji: "🍌",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "2 plates",
    ingredients: [
      "1 ripe banana",
      "2 eggs",
      "1/4 teaspoon cinnamon",
      "Butter for the pan",
      "Maple syrup and berries",
    ],
    steps: [
      "Peel the banana and mash it really well in a bowl.",
      "Crack in the eggs and add cinnamon. Mix until combined.",
      "Ask a grown-up to heat a buttered pan on medium.",
      "Drop small spoonfuls of batter to make mini pancakes.",
      "Cook 1–2 minutes until bubbles show, then flip.",
      "Cook another minute until golden.",
      "Stack the mini bites and drizzle with syrup!",
    ],
    tip: "These are only 3 ingredients — perfect for little chefs!",
  },
  tresleches: {
    name: "Tres Leches Cake",
    emoji: "🍰",
    time: "50 minutes + chilling",
    difficulty: "A Little Tricky",
    servings: "12 slices",
    ingredients: ["1 cup all-purpose flour", "1 1/2 teaspoons baking powder", "1/4 teaspoon salt", "5 eggs, separated", "1 cup sugar, divided", "1/3 cup milk", "1 teaspoon vanilla extract", "1 can (12 oz) evaporated milk", "1 can (14 oz) sweetened condensed milk", "1/4 cup whole milk", "1 cup heavy cream + 2 tablespoons sugar (topping)", "Ground cinnamon, for dusting"],
    steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and grease a 9x13 inch pan.", "Whisk the flour, baking powder, and salt in a bowl.", "Beat the egg yolks with 3/4 cup sugar until pale, then stir in the milk and vanilla and fold in the flour mix.", "Beat the egg whites with the remaining 1/4 cup sugar until stiff peaks form, then fold gently into the batter.", "Pour into the pan and ask a grown-up to bake for 25–30 minutes until a toothpick comes out clean.", "Mix the evaporated milk, condensed milk, and whole milk — that's the famous three-milks soak!", "Poke holes all over the cooled cake with a fork and slowly pour the three-milks mix over it.", "Chill for at least 2 hours (overnight is best), then top with whipped cream and a dusting of cinnamon.", "Slice and enjoy your milky, dreamy Tres Leches Cake!"],
    tip: "The cake should feel like a sponge — it drinks up all three milks and stays super soft.",
    source: "Classic Tres Leches (Preppy Kitchen style)",
  },
  mkchocolate: {
    name: "Cakes by MK Moist Chocolate Cake",
    emoji: "🍫",
    time: "55 minutes",
    difficulty: "Easy",
    servings: "12 slices",
    ingredients: ["2 cups all-purpose flour", "2 cups sugar", "3/4 cup cocoa powder", "2 teaspoons baking powder", "1 1/2 teaspoons baking soda", "1 teaspoon salt", "1 cup milk", "1/2 cup vegetable oil", "2 eggs", "2 teaspoons vanilla extract", "1 cup hot water or hot coffee"],
    steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and grease two 9-inch round pans.", "Whisk all the dry ingredients in a big bowl.", "Add milk, oil, eggs, and vanilla. Mix until smooth.", "Slowly stir in the hot water — the batter will be thin, and that's the secret to moist cake!", "Divide the batter between the pans.", "Ask a grown-up to bake for 30–35 minutes until a toothpick comes out clean.", "Cool in the pans for 10 minutes, then turn out and cool completely.", "Frost with your favourite chocolate frosting and slice!"],
    tip: "Hot coffee makes the chocolate taste even more chocolatey — grown-ups love this trick.",
    source: "Cakes by MK",
    sourceUrl: "https://cakesbymk.com/",
  },
  mkvanilla: {
    name: "Cakes by MK Soft Vanilla Cake",
    emoji: "🍰",
    time: "55 minutes",
    difficulty: "Easy",
    servings: "12 slices",
    ingredients: ["2 1/2 cups all-purpose flour", "2 1/2 teaspoons baking powder", "1/2 teaspoon salt", "3/4 cup soft butter", "1 3/4 cups sugar", "4 egg whites, room temperature", "2 teaspoons vanilla extract", "1 cup milk, room temperature", "1/4 cup vegetable oil"],
    steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and grease two 8-inch round pans.", "Whisk flour, baking powder, and salt together.", "Beat the butter and sugar until pale and fluffy (about 3 minutes).", "Beat in the egg whites one at a time, then the vanilla.", "Add the flour mix in three parts, alternating with the milk and oil. Mix gently!", "Divide between the pans and smooth the tops.", "Ask a grown-up to bake for 30–35 minutes until springy to the touch.", "Cool completely, frost, add sprinkles, and serve your soft cloud cake!"],
    tip: "Room-temperature ingredients mix more smoothly and make a softer crumb.",
    source: "Cakes by MK",
    sourceUrl: "https://cakesbymk.com/",
  },
  mkredvelvet: {
    name: "Cakes by MK Eggless Red Velvet Cake",
    emoji: "❤️",
    time: "55 minutes",
    difficulty: "Easy",
    servings: "12 slices",
    ingredients: ["2 1/2 cups all-purpose flour", "2 tablespoons cocoa powder", "1 teaspoon baking soda", "1/2 teaspoon salt", "1 1/2 cups sugar", "1 1/2 cups buttermilk (or milk + 1 tablespoon vinegar)", "3/4 cup vegetable oil", "2 teaspoons vanilla extract", "1–2 teaspoons red food colouring", "Cream-cheese frosting, to decorate"],
    steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and grease two 8-inch pans.", "If making buttermilk: stir vinegar into milk and wait 5 minutes until it curdles slightly.", "Whisk flour, cocoa, baking soda, and salt in one bowl.", "In another bowl, whisk sugar, buttermilk, oil, vanilla, and red colouring — no eggs needed!", "Fold the dry mix into the wet mix until just combined.", "Divide between the pans.", "Ask a grown-up to bake for 30–35 minutes until a toothpick comes out clean.", "Cool completely, layer with cream-cheese frosting, and admire that red velvet glow!"],
    tip: "Eggless cakes like a gentle fold — overmixing makes them dense instead of velvety.",
    source: "Cakes by MK",
    sourceUrl: "https://cakesbymk.com/",
  },
  mkloaf: {
    name: "Chocolate Loaf Cake (Cakes by MK)",
    emoji: "🍞",
    time: "60 minutes",
    difficulty: "Easy",
    servings: "10 slices",
    ingredients: ["1 1/2 cups all-purpose flour", "1/2 cup cocoa powder", "1 teaspoon baking powder", "1/2 teaspoon baking soda", "1/2 teaspoon salt", "1 cup sugar", "2 eggs", "1/2 cup vegetable oil", "3/4 cup buttermilk or yogurt", "1 teaspoon vanilla extract", "1/2 cup hot water", "Chocolate chips (optional crunch on top)"],
    steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and line a loaf pan with parchment.", "Whisk flour, cocoa, baking powder, baking soda, and salt.", "Whisk sugar, eggs, oil, buttermilk, and vanilla until smooth.", "Fold in the dry ingredients, then stir in the hot water until glossy.", "Pour into the loaf pan and sprinkle chocolate chips on top if you like.", "Ask a grown-up to bake for 45–55 minutes until a toothpick comes out with a few moist crumbs.", "Cool for 15 minutes before lifting out of the pan.", "Slice thick, serve with milk, and enjoy your bakery-style loaf!"],
    tip: "A parchment sling (paper hanging over the sides) makes lifting the loaf out easy.",
    source: "Cakes by MK",
    sourceUrl: "https://cakesbymk.com/",
  },
  nihari: {
    name: "Beef Nihari",
    emoji: "🍲",
    time: "3 hours",
    difficulty: "A Little Tricky",
    servings: "6 bowls",
    ingredients: ["1 kg beef shank (bong) pieces", "1/2 cup oil or ghee", "1 large onion, sliced", "2 tablespoons ginger-garlic paste", "3–4 tablespoons nihari masala", "1 teaspoon red chilli powder", "1/2 teaspoon turmeric", "Salt to taste", "1/2 cup whole-wheat flour (atta) mixed in water", "Julienned ginger, green chillies, lemon & coriander to serve"],
    steps: ["Ask a grown-up to heat oil in a heavy pot and fry the onion until golden.", "Add beef and ginger-garlic paste. Fry until the meat changes colour.", "Add nihari masala, chilli, turmeric, and salt with a splash of water. Fry 5 minutes.", "Pour in 6–8 cups of water, cover, and simmer on low for 2–3 hours until the beef is fall-apart tender.", "Take out the cooked meat pieces and set aside.", "Slowly whisk the flour slurry into the gravy and simmer 15 minutes until glossy and thick.", "Return the meat, simmer 10 more minutes.", "Serve hot with ginger, chillies, lemon wedges, coriander, and warm naan!"],
    tip: "Nihari tastes even better the next day — the flavours melt together overnight.",
  },
  biryani: {
    name: "Chicken Biryani",
    emoji: "🍛",
    time: "1 hour 15 minutes",
    difficulty: "A Little Tricky",
    servings: "6 plates",
    ingredients: ["3 cups basmati rice, soaked 30 minutes", "750 g chicken pieces", "1 cup yogurt", "3 onions, thinly sliced and fried golden", "2 tomatoes, chopped", "2 tablespoons ginger-garlic paste", "3 tablespoons biryani masala", "Whole spices: bay leaves, cinnamon, cardamom, cloves", "Fresh mint & coriander", "Saffron or yellow food colour in milk", "4 tablespoons oil or ghee", "Salt to taste"],
    steps: ["Marinate the chicken with yogurt, ginger-garlic paste, biryani masala, and salt for 30 minutes.", "Ask a grown-up to boil the rice with whole spices until 70% cooked, then drain.", "In a big pot, cook the marinated chicken with tomatoes and half the fried onions until the oil separates.", "Layer rice over the chicken: rice, fried onions, mint, coriander — repeat!", "Drizzle the saffron milk and ghee on top.", "Cover tightly and steam (dum) on low heat for 20–25 minutes.", "Rest 10 minutes, then gently fluff and mix the layers.", "Serve with raita and salad. Biryani party!"],
    tip: "70% cooked rice finishes perfectly in the steam — soft grains, never mushy.",
  },
  butterchicken: {
    name: "Butter Chicken",
    emoji: "🧈",
    time: "45 minutes",
    difficulty: "Easy",
    servings: "4 bowls",
    ingredients: ["500 g boneless chicken cubes", "1/2 cup yogurt", "1 tablespoon ginger-garlic paste", "1 teaspoon each: red chilli, turmeric, garam masala", "3 tablespoons butter", "1 cup tomato purée", "1/2 cup cream", "1 teaspoon kasuri methi (dried fenugreek)", "1 teaspoon honey or sugar", "Salt to taste"],
    steps: ["Marinate chicken with yogurt, ginger-garlic, spices, and salt for 30 minutes.", "Ask a grown-up to sear the chicken in 1 tablespoon butter until lightly charred. Set aside.", "Melt the remaining butter, add tomato purée, and cook until the butter shines on top.", "Blend the sauce smooth if you like (grown-up job!), then return to the pan.", "Stir in cream, honey, and crushed kasuri methi.", "Add the chicken and simmer 8–10 minutes until cooked through.", "Swirl extra cream on top.", "Serve with naan or rice and scoop up every drop!"],
    tip: "A tiny bit of honey balances the tomatoes — that's the restaurant secret.",
  },
  daal: {
    name: "Daal (Yellow Lentils)",
    emoji: "🍵",
    time: "40 minutes",
    difficulty: "Easy",
    servings: "4 bowls",
    ingredients: ["1 cup moong or masoor daal, washed", "3 cups water", "1/2 teaspoon turmeric", "1 teaspoon red chilli powder", "Salt to taste", "For baghaar (tempering): 3 tablespoons oil or ghee", "4 garlic cloves, sliced", "1 teaspoon cumin seeds", "2–3 whole red chillies", "Fresh coriander & lemon to serve"],
    steps: ["Put the washed daal, water, turmeric, chilli, and salt in a pot.", "Ask a grown-up to boil, skim the foam, then simmer 25–30 minutes until soft and creamy.", "Whisk gently for a smooth texture and adjust the water to your liking.", "For the baghaar: heat oil, add cumin, garlic, and red chillies until the garlic is golden.", "Pour the sizzling baghaar over the daal — listen to that sizzle!", "Garnish with coriander and a squeeze of lemon.", "Serve with steamed rice or roti. Simple comfort food!"],
    tip: "The garlic baghaar at the end is where all the magic flavour lives.",
  },
  samosa: {
    name: "Samosa",
    emoji: "🥟",
    time: "1 hour",
    difficulty: "A Little Tricky",
    servings: "12 samosas",
    ingredients: ["2 cups all-purpose flour", "1/4 cup oil, 1 teaspoon ajwain & salt (for dough)", "3 potatoes, boiled & crumbled", "1/2 cup peas", "1 teaspoon each: cumin, coriander powder, chaat masala", "1/2 teaspoon red chilli & turmeric", "1 tablespoon ginger, grated", "Fresh coriander", "Oil for deep frying"],
    steps: ["Rub oil into the flour, ajwain, and salt until crumbly, then knead a stiff dough with a little water. Rest 30 minutes.", "Heat a little oil, sizzle cumin and ginger, then add peas, potatoes, and all the spices. Cool the filling.", "Roll small ovals of dough, cut in half, and fold each half into a cone (seal the edge with water).", "Fill each cone with potato mixture and seal the top edge firmly.", "Ask a grown-up to deep-fry on medium-low until golden and bubbly-crisp (about 10 minutes).", "Drain on paper towels.", "Serve hot with imli (tamarind) chutney. Crunch time!"],
    tip: "Fry on low-medium heat — slow frying makes the crispiest, flakiest crust.",
  },
  mangolassi: {
    name: "Mango Lassi",
    emoji: "🥭",
    time: "10 minutes",
    difficulty: "Super Easy",
    servings: "2 glasses",
    ingredients: ["2 ripe mangoes (or 1 cup mango pulp)", "1 cup yogurt", "1/2 cup milk", "2–3 tablespoons sugar or honey", "A pinch of cardamom powder", "Ice cubes", "Crushed pistachios (optional topping)"],
    steps: ["Wash the mangoes and ask a grown-up to help peel and chop them.", "Put mango, yogurt, milk, sugar, and cardamom in a blender.", "Blend until silky smooth.", "Taste — add more sugar if your mangoes are tangy!", "Pour over ice in tall glasses.", "Sprinkle pistachios on top.", "Sip your sunshine smoothie!"],
    tip: "Super-ripe, fragrant mangoes make the sweetest lassi with almost no sugar.",
  },
  masalachai: {
    name: "Masala Chai",
    emoji: "☕",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "2 cups",
    ingredients: ["2 cups water", "1 cup milk", "2 teaspoons black tea (or 2 tea bags)", "2–3 teaspoons sugar", "1 small piece ginger, crushed", "3 cardamom pods, crushed", "1 small cinnamon stick", "2 cloves (optional)"],
    steps: ["Ask a grown-up to simmer water with ginger, cardamom, cinnamon, and cloves for 3 minutes.", "Add the tea and boil for 2 minutes until deep amber.", "Pour in the milk and sugar.", "Bring to a rolling boil, then lower the heat. Repeat this rise-and-fall twice for a strong karak flavour.", "Strain into cups with a small sieve.", "Serve piping hot with biscuits for dunking!"],
    tip: "Crushing the spices fresh releases way more flavour than pre-ground mixes.",
  },
  haleem: {
    name: "Haleem",
    emoji: "🍲",
    time: "3 hours",
    difficulty: "A Little Tricky",
    servings: "8 bowls",
    ingredients: ["500 g beef or chicken", "1 cup cracked wheat (daliya), soaked overnight", "1/4 cup each: chana daal, masoor daal, moong daal & barley", "2 onions, fried golden", "2 tablespoons ginger-garlic paste", "3 tablespoons haleem masala", "1/2 cup oil or ghee", "Salt to taste", "Ginger, green chillies, lemon, coriander & fried onions to serve"],
    steps: ["Cook the soaked wheat and lentils in plenty of water until completely soft and mushy.", "In another pot, cook the meat with ginger-garlic, haleem masala, and salt until tender; shred it finely.", "Blend the wheat-lentil mix until smooth and porridge-like (grown-up job!).", "Combine everything in one big pot and stir on low heat for 30–45 minutes, mashing as you go — haleem should be stretchy and gluey!", "Stir in half the fried onions and a drizzle of ghee.", "Serve in bowls topped with ginger, chillies, lemon, coriander, and crispy onions."],
    tip: "Constant stirring at the end gives haleem its famous stretchy texture.",
  },
  seekhkabab: {
    name: "Seekh Kabab",
    emoji: "🍢",
    time: "40 minutes + marinating",
    difficulty: "A Little Tricky",
    servings: "8 kababs",
    ingredients: ["500 g minced beef or chicken", "1 onion, very finely chopped & squeezed dry", "2 tablespoons ginger-garlic paste", "2 green chillies, minced", "1 tablespoon seekh kabab masala", "1 teaspoon roasted cumin & coriander powder", "2 tablespoons fresh coriander", "1 tablespoon lemon juice", "Salt to taste", "Skewers & a little oil"],
    steps: ["Mix everything in a bowl and knead for 5 minutes until sticky and smooth.", "Chill the mixture for 1 hour — cold mince holds the skewer better!", "With wet hands, mould sausage shapes around the skewers.", "Ask a grown-up to grill or pan-fry, turning every 2 minutes, until charred at the edges (10–12 minutes).", "Rest 2 minutes, then slide off the skewers.", "Serve with naan, onion rings, and mint chutney!"],
    tip: "Squeeze every drop of water from the onion or the kababs will fall apart.",
  },
  chaplikabab: {
    name: "Chapli Kabab",
    emoji: "🥩",
    time: "45 minutes",
    difficulty: "A Little Tricky",
    servings: "8 kababs",
    ingredients: ["500 g minced beef", "1 tomato, finely chopped (+ slices for topping)", "1 onion, finely chopped", "2 tablespoons coriander seeds, crushed", "1 tablespoon pomegranate seeds (anardana), crushed", "2 green chillies, chopped", "1 egg + 2 tablespoons gram flour (binder)", "1 teaspoon each: cumin, red chilli flakes, garam masala", "Salt to taste", "Oil for shallow frying"],
    steps: ["Mix the mince with all the spices, onion, tomato, chillies, egg, and gram flour.", "Rest the mixture for 30 minutes.", "Shape into large, flat patties with wet hands.", "Press a tomato slice into the top of each patty — chapli kabab signature!", "Ask a grown-up to shallow-fry on medium heat for 4–5 minutes per side until crisp and cooked.", "Drain briefly on paper towels.", "Serve hot with naan, raita, and lemon wedges. Peshawar style!"],
    tip: "Flat patties cook evenly and get those famous crispy edges.",
  },
  pulao: {
    name: "Chicken Pulao",
    emoji: "🍚",
    time: "1 hour",
    difficulty: "Easy",
    servings: "6 plates",
    ingredients: ["3 cups basmati rice, soaked 30 minutes", "750 g chicken pieces", "2 onions, sliced", "1/2 cup yogurt", "2 tablespoons ginger-garlic paste", "Whole spices: bay leaf, cinnamon, black cardamom, cloves, cumin", "2 teaspoons coriander powder", "4 1/2 cups chicken stock or water", "4 tablespoons oil or ghee", "Salt to taste", "Fried onions & coriander to serve"],
    steps: ["Ask a grown-up to fry the onions in ghee until golden; set half aside for garnish.", "Add whole spices and ginger-garlic, sizzle for 30 seconds.", "Add chicken and fry until it turns white-golden.", "Stir in yogurt, coriander powder, and salt. Cook until the oil separates.", "Pour in the stock, bring to a boil, then add the drained rice.", "Cook uncovered until most water is absorbed, then cover and steam on low for 15 minutes.", "Fluff gently and top with the reserved fried onions.", "Serve with raita and salad!"],
    tip: "Pulao gets its colour from golden fried onions — take your time browning them.",
  },
  mandi: {
    name: "Chicken Mandi",
    emoji: "🍗",
    time: "1 hour 30 minutes",
    difficulty: "A Little Tricky",
    servings: "6 plates",
    ingredients: ["1 whole chicken or 750 g legs", "Mandi spice: 1 tablespoon each coriander & cumin, 1 teaspoon each turmeric, black pepper, cardamom, cinnamon", "3 cups basmati rice, soaked", "2 onions, sliced & fried", "4 cups chicken stock", "A pinch of saffron in warm milk", "Raisins & almonds, fried (topping)", "1 small piece of charcoal + 1 teaspoon ghee (for smoke, grown-up job!)", "Salt to taste"],
    steps: ["Rub the chicken with mandi spices and salt; marinate 30 minutes.", "Ask a grown-up to grill, roast, or steam the chicken until juicy and cooked through.", "Cook the rice: boil stock with spices, add drained rice, cook until tender, then drizzle saffron milk.", "Rest the chicken on top of the rice in the pot.", "Smoke trick (grown-ups only!): place hot charcoal in a small bowl on the rice, drizzle ghee, cover fast for 5 minutes.", "Uncover — hello, smoky mandi aroma!", "Serve on a big platter: rice first, chicken on top, shower with fried onions, raisins, and almonds."],
    tip: "The charcoal smoke is what makes mandi taste like mandi — never skip it (grown-ups handle it!).",
  },
  karahi: {
    name: "Chicken Karahi",
    emoji: "🍳",
    time: "40 minutes",
    difficulty: "Easy",
    servings: "4 portions",
    ingredients: ["750 g chicken pieces (karahi cut)", "1/2 cup oil or ghee", "5 tomatoes, halved", "2 tablespoons ginger-garlic paste", "2 teaspoons crushed black pepper", "1 teaspoon red chilli flakes", "1 teaspoon roasted cumin, crushed", "Salt to taste", "Julienned ginger, green chillies & coriander to finish"],
    steps: ["Ask a grown-up to heat ghee in a karahi or wok until hot.", "Fry the chicken with ginger-garlic on high heat until it changes colour.", "Add the tomato halves skin-side up, cover for 5 minutes, then peel off the skins with tongs.", "Mash the tomatoes into the chicken and fry on high heat until the ghee separates.", "Add black pepper, chilli flakes, cumin, and salt. Fry 3 more minutes.", "Finish with ginger juliennes, chillies, and coriander.", "Serve sizzling with hot naan straight from the karahi!"],
    tip: "Real karahi has NO onions or yogurt — just tomatoes, chicken, and bold spices.",
  },
  roohafza: {
    name: "Rooh Afza Cooler",
    emoji: "🌹",
    time: "5 minutes",
    difficulty: "Super Easy",
    servings: "2 glasses",
    ingredients: ["3 tablespoons Rooh Afza syrup", "2 cups cold water or milk", "1 teaspoon lemon juice (for water version)", "Ice cubes", "Mint leaves", "Basil seeds (tukhmalanga), soaked, optional"],
    steps: ["Fill two tall glasses with ice cubes.", "Pour Rooh Afza syrup over the ice.", "Top with cold water (classic) or cold milk (creamy version).", "Add a squeeze of lemon to the water version.", "Stir until the colour is a beautiful ruby pink.", "Add soaked basil seeds and a mint leaf if you like.", "Sip the coolest pink drink ever!"],
    tip: "Freeze Rooh Afza in ice-cube trays for pink ice that never waters your drink down.",
  },
  frenchtoast: {
    name: "French Toast",
    emoji: "🍞",
    time: "15 minutes",
    difficulty: "Super Easy",
    servings: "4 slices",
    ingredients: ["4 thick bread slices", "2 eggs", "1/2 cup milk", "1 tablespoon sugar", "1/2 teaspoon cinnamon", "1 teaspoon vanilla extract", "Butter for the pan", "Maple syrup, berries & powdered sugar to serve"],
    steps: ["Whisk eggs, milk, sugar, cinnamon, and vanilla in a shallow bowl.", "Dip each bread slice for about 10 seconds per side — soaked but not falling apart!", "Ask a grown-up to melt butter in a pan on medium heat.", "Cook each slice 2–3 minutes per side until golden and a little crispy.", "Stack on a plate and dust with powdered sugar.", "Drizzle with maple syrup and add berries.", "Bon appétit — breakfast like a Paris café!"],
    tip: "Day-old or thick bread soaks up the custard without going soggy.",
  },

};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const keywordMap: { keys: string[]; id: string }[] = [
  { keys: ["pancake", "pancakes", "hotcake", "flapjack"], id: "pancake" },
  { keys: ["banana pancake", "banana pancakes"], id: "pancakes_special" },
  { keys: ["pizza", "pizzas"], id: "pizza" },
  { keys: ["sandwich", "sandwiches"], id: "sandwich" },
  { keys: ["cookie", "cookies", "chocolate chip"], id: "cookies" },
  { keys: ["smoothie", "smoothies", "shake"], id: "smoothie" },
  { keys: ["pasta", "spaghetti", "noodles"], id: "pasta" },
  { keys: ["egg", "eggs", "scrambled"], id: "eggs" },
  { keys: ["taco", "tacos"], id: "taco" },
  { keys: ["muffin", "muffins", "blueberry muffin"], id: "muffins" },
  { keys: ["nacho", "nachos"], id: "nachos" },
  { keys: ["oatmeal", "oats", "porridge"], id: "oatmeal" },
  { keys: ["hot chocolate", "hot cocoa", "cocoa", "hotchocolate"], id: "hotchocolate" },
  { keys: ["fruit kabob", "fruit kebab", "fruit skewer", "kabob", "rainbow fruit"], id: "fruit" },
  { keys: ["quesadilla", "quesadillas"], id: "quesadilla" },
  { keys: ["popcorn", "movie popcorn"], id: "popcorn" },
  { keys: ["banana pop", "banana pops", "frozen banana", "chocolate banana"], id: "banana" },
  { keys: ["fried rice", "rice"], id: "rice" },
  { keys: ["salad", "rainbow salad"], id: "salad" },
  { keys: ["mac and cheese", "macaroni", "mac cheese", "mac n cheese"], id: "mac" },
  { keys: ["waffle", "waffles"], id: "waffle" },
  { keys: ["soup", "tomato soup"], id: "soup" },
  { keys: ["avocado toast", "avocado", "toast"], id: "toast" },
  { keys: ["brownie", "brownies"], id: "brownie" },
  { keys: ["wrap", "turkey wrap"], id: "wrap" },
  { keys: ["parfait", "yogurt", "yogurt parfait"], id: "yogurt" },
  { keys: ["grilled cheese", "grilledcheese", "cheese sandwich"], id: "grilledcheese" },
  { keys: ["apple nacho", "apple nachos", "cinnamon apple", "apples"], id: "apples" },
  { keys: ["lemonade", "lemon aid", "lemon"], id: "lemonade" },
  { keys: ["sushi", "sushi roll"], id: "sushi" },
  { keys: ["ice cream", "icecream", "ice-cream"], id: "icecream" },
  { keys: ["chicken", "chicken tender", "chicken tenders", "nugget", "nuggets"], id: "chicken" },
  { keys: ["cupcake", "cupcakes"], id: "cupcake" },
  { keys: ["burrito", "burritos"], id: "burrito" },
  { keys: ["tres leches cake", "tres leches", "three milk cake", "three milks cake"], id: "tresleches" },
  { keys: ["moist chocolate cake", "chocolate cake"], id: "mkchocolate" },
  { keys: ["soft vanilla cake", "vanilla cake"], id: "mkvanilla" },
  { keys: ["eggless red velvet cake", "red velvet cake", "red velvet", "eggless cake"], id: "mkredvelvet" },
  { keys: ["chocolate loaf cake", "chocolate loaf", "loaf cake"], id: "mkloaf" },
  { keys: ["beef nihari", "nihari"], id: "nihari" },
  { keys: ["chicken biryani", "biryani"], id: "biryani" },
  { keys: ["butter chicken"], id: "butterchicken" },
  { keys: ["daal", "dal", "dhal", "lentil daal", "yellow lentils"], id: "daal" },
  { keys: ["samosa", "samosas"], id: "samosa" },
  { keys: ["mango lassi", "lassi"], id: "mangolassi" },
  { keys: ["masala chai", "chai", "chai tea", "karak chai"], id: "masalachai" },
  { keys: ["haleem"], id: "haleem" },
  { keys: ["seekh kabab", "seekh kebab"], id: "seekhkabab" },
  { keys: ["chapli kabab", "chapli kebab"], id: "chaplikabab" },
  { keys: ["chicken pulao", "pulao", "pilaf", "yakhni pulao"], id: "pulao" },
  { keys: ["chicken mandi", "mandi"], id: "mandi" },
  { keys: ["chicken karahi", "karahi", "kadai chicken"], id: "karahi" },
  { keys: ["rooh afza", "roohafza", "roo afsa"], id: "roohafza" },
  { keys: ["french toast"], id: "frenchtoast" },
];

function titleCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const GENERIC_SINGLE = new Set(["cake", "rice", "soup", "chicken", "egg", "eggs", "fish", "meat", "drink", "juice"]);

type GenericKind = "meat" | "rice" | "curry" | "soup" | "dessert" | "bread" | "drink" | "salad" | "bbq" | "pasta" | "desi_sweet" | "snack" | "egg";

function detectGenericKind(lowerName: string): GenericKind {
  if (/gulab jamun|jalebi|barfi|laddu|ladoo|halwa|kulfi|kheer|rabri|mithai|rasmalai|shahi tukray/.test(lowerName)) return "desi_sweet";
  if (/bbq|barbecue|grill|kebab|kabab|tikka|seekh|boti|skewer/.test(lowerName)) return "bbq";
  if (/curry|masala|handi|korma|karahi|vindaaloo|vindaloo|salan/.test(lowerName)) return "curry";
  if (/biryani|pulao|pilaf|risotto|rice|jollof|paella/.test(lowerName)) return "rice";
  if (/omelette|omelet|egg|frittata|quiche/.test(lowerName)) return "egg";
  if (/soup|stew|broth|chowder|bisque|shorba/.test(lowerName)) return "soup";
  if (/pasta|spaghetti|noodle|macaroni|fettuccine|penne|lasagna|ramen/.test(lowerName)) return "pasta";
  if (/bread|paratha|naan|roti|bun|sandwich|toast|roll|puri/.test(lowerName)) return "bread";
  if (/juice|drink|shake|smoothie|lassi|chai|tea|coffee|mocktail|sherbet|lemonade/.test(lowerName)) return "drink";
  if (/salad|slaw|raita/.test(lowerName)) return "salad";
  if (/cake|cookie|brownie|pudding|pie|ice cream|custard|dessert|sweet|chocolate|trifle|mousse/.test(lowerName)) return "dessert";
  if (/chicken|beef|lamb|mutton|fish|salmon|prawn|shrimp|meat|steak|turkey/.test(lowerName)) return "meat";
  return "snack";
}

export function generateGenericRecipe(foodName: string): Recipe {
  const name = titleCase(normalize(foodName)) || "Something Yummy";
  const lowerName = name.toLowerCase();
  const kind = detectGenericKind(lowerName);
  const base: Record<GenericKind, { emoji: string; time: string; difficulty: Recipe["difficulty"]; ingredients: string[]; steps: string[]; tip: string }> = {
    meat: {
      emoji: "🍗", time: "40 minutes", difficulty: "A Little Tricky",
      ingredients: [`500 g main protein for ${name}`, "2 tablespoons oil or ghee", "1 onion, sliced", "1 tablespoon ginger-garlic paste", "1 teaspoon salt & 1/2 teaspoon black pepper", "1 teaspoon favourite spice mix", "1/2 cup water or stock", "Fresh herbs & lemon to serve"],
      steps: ["Ask a grown-up to help with the stove and any cutting.", "Season the protein with salt, pepper, and spices. Rest 15 minutes.", "Heat oil in a pan and fry the onion until golden.", "Add ginger-garlic paste, sizzle 30 seconds.", "Add the protein and fry on high heat until it changes colour.", "Add water or stock, cover, and simmer until fully cooked and tender.", "Fry uncovered for 2–3 minutes to thicken the sauce.", `Finish with herbs and lemon. Your ${name} is ready!`],
      tip: "Rest cooked meat 5 minutes before cutting — it stays juicy.",
    },
    rice: {
      emoji: "🍚", time: "45 minutes", difficulty: "Easy",
      ingredients: ["2 cups basmati rice, soaked 30 minutes", "3 1/2 cups water or stock", "2 tablespoons oil or ghee", "1 onion, sliced", "Whole spices: bay leaf, cinnamon, cardamom, cumin", "1 teaspoon salt (to taste)", "1 cup vegetables or cooked protein", "Fried onions & herbs to serve"],
      steps: ["Fry the onion in ghee until golden — this is the flavour base.", "Add whole spices and sizzle for 30 seconds.", "Add vegetables or protein and fry 3 minutes.", "Pour in water or stock and salt; bring to a boil.", "Add the drained rice and cook until most water is absorbed.", "Cover tightly and steam on the lowest heat for 15 minutes — no peeking!", "Rest 5 minutes, then fluff gently with a fork.", `Top with fried onions and herbs. Enjoy your ${name}!`],
      tip: "The steam finish (dum) makes every grain separate and fluffy.",
    },
    curry: {
      emoji: "🍛", time: "45 minutes", difficulty: "Easy",
      ingredients: [`500 g main ingredient for ${name}`, "3 tablespoons oil or ghee", "1 onion, finely chopped", "1 tablespoon ginger-garlic paste", "2 tomatoes, puréed", "1/2 cup yogurt, whisked", "2 teaspoons curry/masala powder, 1/2 teaspoon turmeric", "Salt to taste", "Cream (optional) & coriander to finish"],
      steps: ["Heat oil and fry the onion until deep golden.", "Add ginger-garlic paste and fry 1 minute.", "Add tomato purée and spices; cook until the oil separates at the edges.", "Lower the heat and whisk in the yogurt slowly so it doesn't split.", "Add the main ingredient and a splash of water.", "Cover and simmer until fully cooked and the sauce is glossy.", "Swirl in cream if you like and sprinkle coriander.", `Serve your ${name} with rice or naan!`],
      tip: "Wait for 'oil separates' — that's how you know the curry base is perfect.",
    },
    soup: {
      emoji: "🍲", time: "40 minutes", difficulty: "Easy",
      ingredients: [`2 cups main ingredient for ${name}, chopped`, "1 tablespoon butter or oil", "1 onion & 2 garlic cloves, chopped", "4 cups stock or water", "1 cup mixed vegetables", "1 teaspoon dried herbs", "Salt & pepper to taste", "Cream or lemon to finish"],
      steps: ["Ask a grown-up to melt butter in a big pot.", "Cook onion 5 minutes until soft, add garlic for 30 seconds.", "Add the main ingredient and vegetables; stir 2 minutes.", "Pour in the stock, add herbs, salt, and pepper.", "Boil gently, then simmer 20 minutes.", "Blend part of the soup if you like it creamy (grown-up job!).", "Taste and adjust seasoning.", `Ladle your ${name} into bowls and serve hot!`],
      tip: "Soup tastes even better the next day — make extra!",
    },
    dessert: {
      emoji: "🍰", time: "50 minutes", difficulty: "Easy",
      ingredients: ["2 cups all-purpose flour (or cake flour)", "1 1/2 teaspoons baking powder & 1/2 teaspoon salt", "3/4 cup sugar + more to taste", "1/2 cup soft butter or oil", "2 eggs (or 1/2 cup yogurt for eggless)", "3/4 cup milk", "1 teaspoon vanilla extract", `Star flavour for ${name} (cocoa, fruit, or essence)`],
      steps: ["Ask a grown-up to preheat the oven to 350°F (175°C) and prepare your pan.", "Whisk the flour, baking powder, and salt.", "Beat butter and sugar until pale and fluffy.", "Beat in eggs and vanilla.", "Fold in flour alternating with milk, then add your star flavour.", "Pour into the pan and smooth the top.", "Bake until a toothpick comes out clean (25–40 minutes, pan-size dependent).", `Cool, decorate, and serve your ${name}!`],
      tip: "Room-temperature ingredients = softer, fluffier bakes every time.",
    },
    bread: {
      emoji: "🍞", time: "30 minutes", difficulty: "Easy",
      ingredients: ["2 cups flour (or ready bread/wraps)", "1 teaspoon instant yeast (if baking fresh)", "3/4 cup warm water", "1 teaspoon sugar & 1/2 teaspoon salt", "1 tablespoon oil or butter", `Filling/flavour of your choice for ${name}`, "Extra butter for brushing"],
      steps: ["If using ready bread, warm it gently and jump to the filling step!", "For fresh dough: mix flour, yeast, sugar, salt, water, and oil; knead 8 minutes.", "Rest the dough covered for 30–45 minutes until puffy.", "Roll or shape as needed for your dish.", "Add filling or flavouring.", "Ask a grown-up to bake, toast, or pan-fry until golden.", "Brush with butter for extra shine and taste.", `Serve your warm ${name} right away!`],
      tip: "Warm (not hot) water wakes the yeast without harming it.",
    },
    drink: {
      emoji: "🥤", time: "10 minutes", difficulty: "Super Easy",
      ingredients: ["2 cups cold base: milk, water, or juice", `1 cup star fruit/flavour for ${name}`, "2–3 tablespoons sugar or honey (to taste)", "A pinch of cardamom or a squeeze of lemon", "Lots of ice", "Mint or fruit slices to serve"],
      steps: ["Wash and prepare your star ingredient (peel/chop with a grown-up's help).", "Put everything except ice in a blender or jug.", "Blend or stir until smooth and frothy.", "Taste and adjust sweetness.", "Pour over lots of ice in tall glasses.", "Garnish like a café pro.", `Sip your refreshing ${name}!`],
      tip: "Frozen fruit makes drinks thick and frosty without watering them down.",
    },
    salad: {
      emoji: "🥗", time: "15 minutes", difficulty: "Super Easy",
      ingredients: ["3 cups crisp greens or chopped vegetables", `1 cup star ingredient for ${name}`, "1/2 cup protein or cheese (optional)", "3 tablespoons olive oil or yogurt", "1 tablespoon lemon juice or vinegar", "Salt, pepper & a pinch of sugar", "Nuts, seeds, or croutons for crunch"],
      steps: ["Wash everything really well and dry the greens.", "Chop ingredients into bite-size pieces (grown-ups help with knives!).", "Whisk oil/yogurt, lemon, salt, pepper, and sugar into a dressing.", "Put everything in a big bowl.", "Pour the dressing over just before serving.", "Toss gently so every bite is coated.", "Sprinkle crunch on top.", `Serve your fresh ${name} immediately!`],
      tip: "Dry greens hold dressing better — soggy leaves slide it right off.",
    },
    bbq: {
      emoji: "🍢", time: "40 minutes + marinating", difficulty: "A Little Tricky",
      ingredients: [`500 g meat or vegetables for ${name}, in chunks`, "1/2 cup yogurt", "1 tablespoon ginger-garlic paste", "1 tablespoon BBQ/tikka masala", "1 tablespoon lemon juice & 2 tablespoons oil", "Salt to taste", "Skewers, naan, onion & chutney to serve"],
      steps: ["Mix yogurt, spices, lemon, oil, and salt into a marinade.", "Coat the chunks well and marinate at least 1 hour (overnight = best).", "Thread onto skewers with little gaps between pieces.", "Ask a grown-up to grill or broil, turning every few minutes and basting with oil.", "Cook until the edges char slightly and the centre is fully cooked.", "Rest 3 minutes so juices settle.", `Serve your smoky ${name} with naan and chutney!`],
      tip: "Little charred edges = big BBQ flavour. Don't fear the dark bits!",
    },
    pasta: {
      emoji: "🍝", time: "30 minutes", difficulty: "Easy",
      ingredients: ["250 g pasta or noodles", "2 tablespoons olive oil or butter", "2 garlic cloves, sliced", `1 1/2 cups sauce/flavour base for ${name}`, "1/2 cup grated cheese", "Salt & pepper to taste", "Fresh basil or parsley"],
      steps: ["Ask a grown-up to boil well-salted water for the pasta.", "Cook pasta 1 minute less than the packet says; save a cup of pasta water.", "Warm oil and garlic in a wide pan for 30 seconds.", "Add your sauce base and simmer 3 minutes.", "Add drained pasta with a splash of pasta water.", "Toss for 1–2 minutes until glossy and coated.", "Serve with cheese and herbs.", `Twirl up your ${name} and dig in!`],
      tip: "Pasta water is liquid gold — it makes sauce silky and help it cling.",
    },
    desi_sweet: {
      emoji: "🍬", time: "40 minutes", difficulty: "A Little Tricky",
      ingredients: ["2 cups milk or 1 cup milk powder + 1 cup milk", "3/4 cup sugar (to taste)", "2 tablespoons ghee", "1/2 teaspoon cardamom powder", "A few saffron strands (optional)", `Star ingredient for ${name} (flour, semolina, lentils, or paneer)`, "Crushed pistachios & almonds to decorate"],
      steps: ["Ask a grown-up to stay close — hot sugar and ghee need care.", "Prepare the base (soak, knead, or roast your star ingredient in ghee until fragrant).", "Slowly add warm milk, stirring constantly so no lumps form.", "Add sugar and cardamom; cook on low heat, stirring, until the mixture thickens and leaves the pan sides.", "Shape or set as your sweet requires (balls, squares, or pour into bowls).", "Decorate with nuts and saffron.", "Cool to room temperature or chill.", `Share your homemade ${name} with everyone!`],
      tip: "Low heat and constant stirring is the whole secret of desi sweets.",
    },
    egg: {
      emoji: "🍳", time: "15 minutes", difficulty: "Super Easy",
      ingredients: ["3 eggs", "2 tablespoons milk", "Salt & pepper to taste", "1 tablespoon butter", `Favourite fillings for ${name} (cheese, veggies, herbs)`, "Toast to serve"],
      steps: ["Crack the eggs into a bowl and fish out any shell bits.", "Whisk eggs, milk, salt, and pepper until frothy.", "Ask a grown-up to melt butter in a non-stick pan on low-medium heat.", "Pour in the eggs and let them set for 20 seconds.", "Gently push the edges to the centre, tilting the pan so runny egg flows out.", "Add fillings when the top is still slightly glossy.", "Fold or slide onto toast.", `Enjoy your fluffy ${name} right away!`],
      tip: "Low heat = soft, creamy eggs. High heat makes them rubbery.",
    },
    snack: {
      emoji: "😋", time: "20 minutes", difficulty: "Super Easy",
      ingredients: [`Main ingredients for ${name}`, "1 tablespoon oil or butter", "Salt & favourite seasonings to taste", "A squeeze of lemon or a dipping sauce", "Fresh herbs (optional)", "Something crunchy on the side"],
      steps: ["Wash your hands and lay out everything you need.", "Prepare the main ingredient (grown-ups help with knives and heat).", "Heat the oil or arrange your base on a plate or tray.", "Cook or assemble until golden/warm/set as your snack needs.", "Season while warm so flavours stick.", "Add lemon, herbs, or dip.", `Pile your ${name} onto a plate and share (or not)!`],
      tip: "Snacks taste best eaten within 10 minutes — gather your tasters first!",
    },
  };
  const t = base[kind];
  return { name, emoji: t.emoji, time: t.time, difficulty: t.difficulty, servings: "2–4 people", ingredients: t.ingredients, steps: t.steps, tip: t.tip, isGeneric: true };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
void hashCode;

function normalizeWord(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

function wordsOf(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean).map(normalizeWord);
}

function longestContiguousRun(qWords: string[], kWords: string[]): number {
  let best = 0;
  for (let i = 0; i < qWords.length; i++) {
    for (let j = 0; j < kWords.length; j++) {
      let run = 0;
      while (qWords[i + run] !== undefined && kWords[j + run] !== undefined && qWords[i + run] === kWords[j + run]) run++;
      if (run > best) best = run;
    }
  }
  return best;
}

export function findRecipe(query: string): Recipe {
  const qWords = wordsOf(query);
  if (qWords.length === 0) return generateGenericRecipe("something yummy");
  const qJoined = qWords.join(" ");

  // 1) Exact whole-query match → instant win (generic singles may win ONLY here)
  for (const entry of keywordMap) {
    for (const key of entry.keys) {
      if (wordsOf(key).join(" ") === qJoined && recipeBook[entry.id]) {
        return { ...recipeBook[entry.id] };
      }
    }
  }

  // 2) Contiguous phrase coverage ≥60% of the key; score = key.length × coverage
  let bestId: string | null = null;
  let bestScore = -1;
  for (const entry of keywordMap) {
    for (const key of entry.keys) {
      const kWords = wordsOf(key);
      if (kWords.length === 0) continue;
      if (kWords.length === 1 && GENERIC_SINGLE.has(kWords[0])) continue;
      const run = longestContiguousRun(qWords, kWords);
      const coverage = run / kWords.length;
      if (run >= 1 && coverage >= 0.6) {
        const score = key.length * coverage;
        if (score > bestScore) { bestScore = score; bestId = entry.id; }
      }
    }
  }
  if (bestId && recipeBook[bestId]) return { ...recipeBook[bestId] };

  // 3) Whole-key subsequence fuzzy (skip generic singles)
  let fuzzyId: string | null = null;
  let fuzzyScore = -1;
  for (const entry of keywordMap) {
    for (const key of entry.keys) {
      const kWords = wordsOf(key);
      if (kWords.length === 0) continue;
      if (kWords.length === 1 && GENERIC_SINGLE.has(kWords[0])) continue;
      let qi = 0;
      for (const qw of qWords) {
        if (qw === kWords[qi]) qi++;
        if (qi === kWords.length) break;
      }
      if (qi === kWords.length && key.length > fuzzyScore) { fuzzyScore = key.length; fuzzyId = entry.id; }
    }
  }
  if (fuzzyId && recipeBook[fuzzyId]) return { ...recipeBook[fuzzyId] };

  // 4) Honest generic fallback — never fake an exact match
  return generateGenericRecipe(query);
}

export const suggestionChips = [
  { label: "Pancakes", emoji: "🥞" },
  { label: "Pizza", emoji: "🍕" },
  { label: "Beef Nihari", emoji: "🍲" },
  { label: "Chicken Biryani", emoji: "🍛" },
  { label: "Butter Chicken", emoji: "🧈" },
  { label: "Fried Rice", emoji: "🍚" },
  { label: "Sushi", emoji: "🍣" },
  { label: "Burger", emoji: "🍔" },
  { label: "Pasta", emoji: "🍝" },
  { label: "Waffles", emoji: "🧇" },
  { label: "Smoothie", emoji: "🥤" },
  { label: "Mac & Cheese", emoji: "🧀" },
  { label: "Tacos", emoji: "🌮" },
  { label: "Cookies", emoji: "🍪" },
  { label: "Cupcakes", emoji: "🧁" },
  { label: "Dumplings", emoji: "🥟" },
  { label: "Guacamole", emoji: "🥑" },
  { label: "Brownies", emoji: "🍫" },
  { label: "Lasagna", emoji: "🍝" },
  { label: "Ramen", emoji: "🍜" },
  { label: "French Toast", emoji: "🍞" },
  { label: "Fruit Salad", emoji: "🍓" },
  { label: "Grilled Cheese", emoji: "🥪" },
  { label: "Hummus", emoji: "🫘" },
];