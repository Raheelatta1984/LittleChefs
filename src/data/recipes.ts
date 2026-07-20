export type Recipe = {
  name: string;
  emoji: string;
  time: string;
  difficulty: "Super Easy" | "Easy" | "A Little Tricky";
  servings: string;
  ingredients: string[];
  steps: string[];
  tip: string;
};

import { worldRecipes, worldRecipeKeywords } from "./worldRecipes";

const recipeBook: Record<string, Recipe> = {
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
];

function titleCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function generateGenericRecipe(foodName: string): Recipe {
  const name = titleCase(foodName);
  const emojis = ["🍽️", "😋", "🌟", "👨‍🍳", "🎉", "✨", "🥘", "🍴", "👩‍🍳"];
  const emoji = emojis[Math.abs(hashCode(foodName)) % emojis.length];
  const lowerName = name.toLowerCase();

  // Detect category and provide real template ingredients and steps
  const isSoup = /soup|stew|broth|chowder|bisque/.test(lowerName);
  const isPasta = /pasta|noodle|spaghetti|macaroni|fettuccine/.test(lowerName);
  const isRice = /rice|biryani|pilaf|risotto/.test(lowerName);
  const isMeat = /chicken|beef|pork|lamb|steak|meat|turkey/.test(lowerName);
  const isFish = /fish|salmon|tuna|shrimp|prawn|seafood|crab/.test(lowerName);
  const isVeggie = /vegetable|veggie|tofu|bean|lentil|chickpea/.test(lowerName);
  const isBaked = /cake|bread|muffin|cookie|pie|brownie|cupcake/.test(lowerName);
  const isSalad = /salad|bowl|wrap/.test(lowerName);
  const isSandwich = /sandwich|burger|wrap|sub/.test(lowerName);
  const isDrink = /juice|smoothie|milkshake|tea|coffee|drink/.test(lowerName);

  let ingredients: string[] = [];
  let steps: string[] = [];
  let time = "30 minutes";
  let difficulty: Recipe["difficulty"] = "Easy";
  let tip = "Every great chef started by trying new things. You've got this!";

  if (isSoup) {
    ingredients = [
      `2 cups chopped main ingredient for ${name}`,
      "1 tablespoon oil or butter",
      "1 onion, chopped",
      "2 cloves garlic, minced",
      "4 cups broth (vegetable, chicken, or beef)",
      "1 cup chopped vegetables (carrots, celery, etc.)",
      "1 teaspoon dried herbs (thyme, oregano, or basil)",
      "Salt and pepper to taste",
      "Fresh herbs for garnish",
    ];
    steps = [
      `Ask a grown-up to help with the stove — we're making ${name}!`,
      "Wash all vegetables and chop them into bite-sized pieces.",
      "Heat oil in a big pot over medium heat.",
      "Add onion and cook for 5 minutes until soft.",
      "Add garlic and stir for 30 seconds until it smells amazing.",
      "Add the main ingredient and vegetables. Stir for 2 minutes.",
      "Pour in the broth and add herbs, salt, and pepper.",
      "Bring to a boil, then turn heat to low and simmer for 20 minutes.",
      "Taste and add more salt if needed.",
      "Ladle into bowls and garnish with fresh herbs. Serve hot!",
    ];
    time = "40 minutes";
    tip = "Soup tastes even better the next day — save some for tomorrow!";
  } else if (isPasta) {
    ingredients = [
      "8 oz pasta of your choice",
      "2 tablespoons olive oil or butter",
      "2 cloves garlic, minced",
      "1 cup sauce (tomato, cream, or pesto)",
      "1/2 cup grated cheese (parmesan or cheddar)",
      "Salt and pepper to taste",
      "Fresh herbs (basil or parsley)",
      "Optional: vegetables or protein",
    ];
    steps = [
      `Ask a grown-up to help with boiling water!`,
      "Bring a big pot of salted water to a boil.",
      "Add pasta and cook according to package (usually 8–10 minutes).",
      "While pasta cooks, heat oil in a pan and sauté garlic for 30 seconds.",
      "Add your sauce and heat through.",
      "Drain the pasta (ask a grown-up to help with the hot water!).",
      "Toss pasta with the sauce.",
      "Add cheese and toss again until melty.",
      "Season with salt and pepper. Garnish with fresh herbs!",
      "Serve hot and enjoy your delicious pasta!",
    ];
    tip = "Save a little pasta water — add it to sauce if it's too thick!";
  } else if (isRice) {
    ingredients = [
      "2 cups rice (basmati, jasmine, or your choice)",
      "3 cups water or broth",
      "1 tablespoon oil or butter",
      "1 onion, chopped",
      "2 cloves garlic, minced",
      "1 teaspoon spices (cumin, turmeric, or curry powder)",
      "1 cup vegetables or protein",
      "Salt to taste",
      "Fresh herbs for garnish",
    ];
    steps = [
      `Ask a grown-up to help with the stove!`,
      "Rinse rice in a strainer until water runs clear.",
      "Heat oil in a pot and sauté onion until soft (about 5 minutes).",
      "Add garlic and spices. Stir for 30 seconds.",
      "Add rice and stir for 1 minute to coat with oil and spices.",
      "Pour in water or broth. Add salt.",
      "Bring to a boil, then turn heat to low and cover.",
      "Cook for 15–20 minutes without lifting the lid!",
      "Let it rest for 5 minutes, then fluff with a fork.",
      "Garnish with fresh herbs and serve!",
    ];
    tip = "Don't lift the lid while rice is cooking — it needs the steam!";
  } else if (isMeat || isFish) {
    ingredients = [
      `1 pound ${lowerName} or your choice of protein`,
      "2 tablespoons oil",
      "1 teaspoon salt",
      "1/2 teaspoon pepper",
      "1 teaspoon dried herbs (rosemary, thyme, or oregano)",
      "2 cloves garlic, minced",
      "1 tablespoon lemon juice or vinegar",
      "Vegetables for serving",
    ];
    steps = [
      `Ask a grown-up to help with cutting and cooking!`,
      "Wash your hands before handling raw meat or fish.",
      "Pat the protein dry with paper towels.",
      "Mix oil, salt, pepper, herbs, garlic, and lemon juice in a bowl.",
      "Rub the mixture all over the protein.",
      "Let it sit for 15 minutes to absorb flavors.",
      "Ask a grown-up to heat a pan or grill over medium-high heat.",
      "Cook for 4–6 minutes per side (depending on thickness).",
      "Let it rest for 5 minutes before cutting.",
      "Serve with your favorite vegetables!",
    ];
    difficulty = "A Little Tricky";
    tip = "Let meat rest after cooking — it keeps the juices inside!";
  } else if (isVeggie) {
    ingredients = [
      `2 cups chopped vegetables for ${name}`,
      "2 tablespoons olive oil",
      "2 cloves garlic, minced",
      "1 teaspoon dried herbs",
      "1/2 teaspoon salt",
      "1/4 teaspoon pepper",
      "1/4 cup cheese or nuts (optional)",
      "Fresh herbs for garnish",
    ];
    steps = [
      `Ask a grown-up to help with cutting!`,
      "Wash and chop all vegetables into bite-sized pieces.",
      "Heat oil in a pan over medium heat.",
      "Add garlic and stir for 30 seconds.",
      "Add vegetables and stir-fry for 5–7 minutes until tender-crisp.",
      "Add herbs, salt, and pepper. Stir well.",
      "If using cheese or nuts, add them in the last minute.",
      "Taste and adjust seasoning.",
      "Garnish with fresh herbs.",
      "Serve hot as a side dish or over rice!",
    ];
    tip = "Don't overcook vegetables — they should still have a little crunch!";
  } else if (isBaked) {
    ingredients = [
      "2 cups all-purpose flour",
      "1 teaspoon baking powder",
      "1/2 teaspoon salt",
      "1/2 cup butter, softened",
      "1 cup sugar",
      "2 eggs",
      "1 teaspoon vanilla extract",
      "1/2 cup milk",
      "Optional: chocolate chips, nuts, or fruit",
    ];
    steps = [
      `Ask a grown-up to preheat oven to 350°F (175°C)!`,
      "Grease your baking pan or line with parchment paper.",
      "In a bowl, whisk flour, baking powder, and salt.",
      "In another bowl, beat butter and sugar until fluffy.",
      "Add eggs one at a time, then vanilla.",
      "Mix in half the flour, then milk, then remaining flour.",
      "Fold in any extras like chocolate chips or nuts.",
      "Pour batter into the pan.",
      "Bake for 25–35 minutes (check with a toothpick — it should come out clean!).",
      "Let cool before cutting or frosting!",
    ];
    time = "45 minutes";
    tip = "Don't open the oven door while baking — it can make your treat fall!";
  } else if (isSalad) {
    ingredients = [
      `4 cups greens (lettuce, spinach, or arugula)`,
      "1 cup chopped vegetables (tomatoes, cucumbers, peppers)",
      "1/2 cup protein (chicken, beans, or cheese)",
      "1/4 cup nuts or seeds",
      "1/4 cup dressing (vinaigrette or your favorite)",
      "Salt and pepper to taste",
    ];
    steps = [
      `Wash your hands and all vegetables!`,
      "Wash and dry the greens thoroughly.",
      "Chop all vegetables into bite-sized pieces.",
      "Put greens in a big bowl.",
      "Add vegetables, protein, and nuts/seeds.",
      "Drizzle dressing over the top.",
      "Toss everything together gently.",
      "Taste and add salt/pepper if needed.",
      "Serve immediately while fresh and crispy!",
    ];
    time = "15 minutes";
    difficulty = "Super Easy";
    tip = "Add dressing right before serving — otherwise the salad gets soggy!";
  } else if (isSandwich) {
    ingredients = [
      "2 slices bread, bun, or wrap",
      "2 tablespoons spread (mayo, mustard, hummus, or butter)",
      "2–3 slices protein (meat, cheese, or tofu)",
      "Lettuce leaves",
      "Tomato slices",
      "Onion slices (optional)",
      "Pickles or other veggies",
      "Salt and pepper to taste",
    ];
    steps = [
      `Wash your hands!`,
      "Lay out bread on a clean plate.",
      "Spread your choice of spread on one or both slices.",
      "Layer on protein, then cheese if using.",
      "Add lettuce, tomato, onion, and pickles.",
      "Season with a little salt and pepper.",
      "Put the top slice of bread on and press gently.",
      "Ask a grown-up to help cut it in half.",
      "Serve with chips or fruit on the side!",
    ];
    time = "10 minutes";
    difficulty = "Super Easy";
    tip = "Toast the bread first for extra crunch and flavor!";
  } else if (isDrink) {
    ingredients = [
      "2 cups liquid base (milk, juice, or water)",
      "1 cup fruit (fresh or frozen)",
      "1–2 tablespoons sweetener (honey, sugar, or syrup)",
      "Ice cubes (optional)",
      "Fresh mint or lemon slice for garnish",
    ];
    steps = [
      `Ask a grown-up to help with the blender if needed!`,
      "Wash all fruits thoroughly.",
      "Chop fruits into chunks if using fresh.",
      "Put liquid base, fruit, and sweetener in a blender.",
      "Blend on high for 1–2 minutes until smooth.",
      "Taste and add more sweetener if needed.",
      "Pour into glasses over ice if using.",
      "Garnish with mint or a lemon slice.",
      "Serve immediately and enjoy your refreshing drink!",
    ];
    time = "5 minutes";
    difficulty = "Super Easy";
    tip = "Frozen fruit makes drinks extra cold and thick — no ice needed!";
  } else {
    // Generic template for anything else
    ingredients = [
      `Main ingredients for ${name}`,
      "2 tablespoons oil or butter",
      "1 onion, chopped",
      "2 cloves garlic, minced",
      "1 teaspoon salt",
      "1/2 teaspoon pepper",
      "1 teaspoon herbs or spices of your choice",
      "1/2 cup liquid (water, broth, or sauce)",
      "Fresh herbs for garnish",
    ];
    steps = [
      `Ask a grown-up to help you make ${name}!`,
      "Wash your hands and gather all ingredients.",
      "Chop vegetables and prepare main ingredients.",
      "Heat oil in a pan over medium heat.",
      "Add onion and cook for 5 minutes until soft.",
      "Add garlic and stir for 30 seconds.",
      "Add main ingredients and cook for 5–10 minutes.",
      "Add herbs, spices, salt, pepper, and liquid.",
      "Simmer for 10–15 minutes until everything is cooked through.",
      "Taste and adjust seasoning. Garnish and serve!",
    ];
    tip = "Cooking is all about experimenting — don't be afraid to try new things!";
  }

  return {
    name: `${name}`,
    emoji,
    time,
    difficulty,
    servings: "2–4 people",
    ingredients,
    steps,
    tip,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function findRecipe(query: string): Recipe {
  const q = normalize(query);
  if (!q) return generateGenericRecipe("something yummy");

  // Longer / more specific keys first
  const sorted = [...keywordMap].sort(
    (a, b) => Math.max(...b.keys.map((k) => k.length)) - Math.max(...a.keys.map((k) => k.length))
  );

  for (const entry of sorted) {
    for (const key of entry.keys) {
      if (q.includes(key) || key.includes(q)) {
        return { ...recipeBook[entry.id] };
      }
    }
  }

  // Fuzzy: check if any word matches
  const words = q.split(" ");
  for (const entry of sorted) {
    for (const key of entry.keys) {
      for (const w of words) {
        if (w.length > 3 && (key.includes(w) || w.includes(key))) {
          return { ...recipeBook[entry.id] };
        }
      }
    }
  }

  // Try world recipes next
  for (const entry of worldRecipeKeywords) {
    for (const key of entry.keys) {
      if (q.includes(key) || key.includes(q)) {
        return { ...worldRecipes[entry.id] };
      }
    }
  }

  // Fuzzy match for world recipes
  const queryWords = q.split(" ");
  for (const entry of worldRecipeKeywords) {
    for (const key of entry.keys) {
      for (const w of queryWords) {
        if (w.length > 3 && (key.includes(w) || w.includes(key))) {
          return { ...worldRecipes[entry.id] };
        }
      }
    }
  }

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