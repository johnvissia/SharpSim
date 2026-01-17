# **App Name**: SharpSim: SportsEdge Trainer

## Core Features:

- User Authentication: Secure user accounts using Firebase Authentication to save user progress and bet history.
- Virtual Currency & Daily Store: Implement a virtual currency system ('Fake Coins') with a daily allowance of 10 coins that resets at 12:01 AM (server time), managed in the 'Store'.
- Live Odds Aggregation & Display: Fetch and compare real-time betting lines from multiple sportsbooks (FanDuel, DraftKings, BetMGM, etc.) and display the best available odds to the user.
- Favorites & Priority Sorting: Allow users to 'star' favorite sports/teams, and automatically sort them to the top of the dashboard feed.
- Expected Value (EV) 'Sharp Indicator': Calculate Expected Value (EV) for each bet by comparing sportsbook lines against market consensus, highlighting value edges.
- Interactive Stats Modal: Enable users to view a player's 'Last 5 Games' stats via an interactive modal when browsing Player Props.
- Coaching Engine: Analyze user betting history (wins/losses by sport, bet type, and margin of error) and give tailored actionable feedback and improvement tips using the 'tool' (LLM model).

## Style Guidelines:

- Primary color: A vibrant blue (#29ABE2) evokes a sense of trust, authority, and competence. Avoid teal, which was not requested by the user.
- Background color: A light blue (#E1F5FE), close to the primary hue but very desaturated.
- Accent color: A complementary yellow/orange (#F9A825) is used for call to actions such as key value messaging, interactive components such as buttons, and data visualization such as charts.
- Body and headline font: 'Inter', a grotesque-style sans-serif with a modern, machined, objective, neutral look.
- Consistent iconography representing different sports (basketball, football, baseball, etc.).
- Clean and intuitive dashboard layout with clear sections for the main feed, 'My Picks,' and user profile.
- Subtle transitions and animations to provide feedback on user interactions (e.g., placing a bet, updating live scores).