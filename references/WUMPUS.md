# Hunt the Wumpus — History and Rules

## Origins

**Hunt the Wumpus** was created by **Gregory Yob** in 1973, originally written in BASIC for mainframe computers. It was first published in the **People's Computer Company** newsletter and later included in the influential book *Creative Computing: More BASIC Computer Games* (1979), edited by David Ahl.

Yob created the game as a reaction to the grid-based "hide and seek" games popular at the time (like *Hurkle*, *Mugwump*, and *Snark*). He wanted a game that used a more interesting topology — a dodecahedron — rather than a simple Cartesian grid. As he wrote: "It just bugged me that all those games put you on a 10×10 grid."

## The Cave

The Wumpus lives in a cave system of **20 rooms** connected in the shape of a **dodecahedron** — a 12-faced regular solid where each vertex (room) connects to exactly 3 other rooms via tunnels. This means:

- Every room has exactly **3 exits**
- The cave is a closed, connected graph — you can reach any room from any other
- The topology is the same as the vertices and edges of a dodecahedron (or equivalently, the faces of an icosahedron)

The original game's adjacency table (rooms 1–20 with their 3 connected rooms) is hardcoded as DATA statements in the BASIC source.

## Hazards

The cave contains several dangers:

### The Wumpus
- A fearsome creature that is usually **asleep**
- Has **sucker feet** (not bothered by pits) and is **too heavy for bats** to lift
- Two things wake the Wumpus: **entering its room** or **shooting an arrow**
- When awakened, the Wumpus either:
  - **Moves to an adjacent room** (75% chance), or
  - **Stays put** (25% chance)
- If the Wumpus ends up in your room after moving, **it eats you** (you lose)

### Bottomless Pits (2)
- Two rooms contain bottomless pits
- If you enter a pit room, **you fall in and lose**
- The Wumpus is not affected by pits (sucker feet)

### Super Bats (2)
- Two rooms contain super bats
- If you enter a bat room, **a bat grabs you and drops you in a random room**
- This may be helpful or harmful — you might land on the Wumpus or a pit
- The bats return to their original room

## Warnings

When you are **one room away** from a hazard, you receive a warning:

| Hazard | Warning |
|--------|---------|
| Wumpus | "I smell a Wumpus!" |
| Pit | "I feel a draft!" |
| Bats | "Bats nearby!" |

Warnings tell you a hazard is adjacent but **not which direction**. With 3 exits per room, you must reason about which room likely contains the danger.

## Actions

Each turn you may either **move** or **shoot**.

### Moving
- You can move to **one adjacent room** (through one tunnel)
- You may also stay in your current room (in the original game)
- After moving, hazards are checked in order: Wumpus → Pits → Bats

### Shooting (Crooked Arrows)
- You have **5 crooked arrows**
- Each arrow can travel through **1 to 5 rooms**
- You specify the room numbers you want the arrow to pass through
- If a tunnel exists to the specified room, the arrow goes there
- If **no tunnel exists**, the arrow flies to a **random adjacent room** instead
- The arrow **cannot double back** — it can't go to the room it was in two steps ago
- If the arrow **hits the Wumpus**, you win!
- If the arrow **hits you**, you lose!
- After a missed shot, the Wumpus **wakes up and may move**
- When you run out of arrows, you lose

## Strategy

- **Track hazard warnings** across multiple rooms to triangulate the Wumpus position
- A room adjacent to both a "smell" and a "draft" is dangerous — the Wumpus and a pit are both nearby
- Shooting into a room you suspect contains the Wumpus is safer than entering it
- Multi-room arrow paths increase your chances but also increase the risk of the arrow hitting you
- If bats move you, your mental map of hazard locations still holds — the hazards don't move (except the Wumpus)

## Cultural Impact

Hunt the Wumpus is considered one of the earliest examples of:
- **Non-grid game topology** (graph-based movement)
- **Inference-based gameplay** (using indirect clues to locate a hidden target)
- **Survival/adventure game** mechanics

It influenced many later games including the *Zork* series and other text adventures. The concept of navigating a dangerous cave with limited information became a foundational pattern in game design.

## Variants

Gregory Yob himself created additional versions:
- **Wump2**: Different cave arrangements beyond the dodecahedron
- **Wump3**: Different hazard types and mechanics

The game has been reimplemented hundreds of times across virtually every programming language and platform since 1973.

## References

- Yob, Gregory. "Hunt the Wumpus." *People's Computer Company*, Vol. 2, No. 1, September 1973.
- Ahl, David H. *More BASIC Computer Games*. Creative Computing Press, 1979.
- Original BASIC source code: see `wumpus.bas` in this directory.
