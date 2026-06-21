# AI research prompt pack

Gaps: 222 strains (103 missing genetics, 222 missing terpenes).
Paste each batch below into Claude or Gemini. Save the combined JSON replies into one
file (a JSON array), then run:

    node scripts/draft-research.mjs --ingest data-review/ai-response.json


---

## PASTE THIS AS ONE MESSAGE — batch 1 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Blue Dream (hybrid) — current effects: Relaxed, Happy, Euphoric, Creative, Uplifted
2. OG Kush (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Hungry
3. Girl Scout Cookies (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Creative
4. Sour Diesel (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
5. Granddaddy Purple (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
6. Jack Herer (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
7. Gelato (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
8. Northern Lights (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Hungry
9. White Widow (hybrid) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
10. Wedding Cake (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Hungry
11. Gorilla Glue #4 (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
12. Pineapple Express (hybrid) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
13. Purple Haze (sativa) — current effects: Happy, Euphoric, Creative, Energetic, Uplifted
14. Bubba Kush (indica) — current effects: Relaxed, Sleepy, Happy, Hungry, Euphoric
15. Green Crack (sativa) — current effects: Energetic, Happy, Uplifted, Euphoric, Focused
16. AK-47 (hybrid) — current effects: Happy, Uplifted, Relaxed, Euphoric, Creative
17. Strawberry Cough (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
18. Zkittlez (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Focused
19. Runtz (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
20. Mimosa (hybrid) — current effects: Happy, Uplifted, Euphoric, Energetic, Focused


---

## PASTE THIS AS ONE MESSAGE — batch 2 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Do-Si-Dos (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
2. MAC (Miracle Alien Cookies) (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed
3. Trainwreck (hybrid) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
4. Skywalker OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
5. Durban Poison (sativa) — current effects: Energetic, Uplifted, Happy, Focused, Creative
6. Lemon Haze (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
7. Cherry Pie (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Giggly
8. Purple Punch (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
9. Cereal Milk (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Giggly
10. Ice Cream Cake (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
11. Super Lemon Haze (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
12. GSC Thin Mint (hybrid) — current effects: Relaxed, Happy, Euphoric, Creative, Uplifted
13. Banana Kush (indica) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
14. Biscotti (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Tingly
15. Sunset Sherbet (indica) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
16. Blue Cheese (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Hungry
17. Tangie (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
18. Amnesia Haze (sativa) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
19. Wedding Crasher (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Talkative
20. Maui Wowie (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative


---

## PASTE THIS AS ONE MESSAGE — batch 3 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. King Louis XIII (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
2. Forbidden Fruit (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Tingly
3. Platinum OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
4. Headband (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
5. Larry OG (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Focused
6. Candy Kush (hybrid) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
7. Critical Mass (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Hungry
8. LA Confidential (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
9. Super Silver Haze (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
10. Bruce Banner #3 (hybrid) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
11. Apple Fritter (hybrid) — current effects: Relaxed, Happy, Euphoric, Tingly, Giggly
12. London Pound Cake (indica) — current effects: Relaxed, Sleepy, Happy, Hungry, Euphoric
13. Gary Payton (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Talkative
14. Jealousy (hybrid) — current effects: Relaxed, Happy, Euphoric, Tingly, Creative
15. Slurricane (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
16. Lava Cake (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Tingly
17. White Runtz (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
18. Dosidos (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Uplifted
19. Kush Mints (hybrid) — current effects: Relaxed, Happy, Euphoric, Tingly, Creative
20. GMO Cookies (indica) — current effects: Relaxed, Sleepy, Happy, Hungry, Euphoric


---

## PASTE THIS AS ONE MESSAGE — batch 4 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Gorilla Cookies (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
2. MAC 1 (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed
3. Tropicana Cookies (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
4. Orange Cookies (hybrid) — current effects: Happy, Relaxed, Uplifted, Euphoric, Creative
5. Mango Kush (indica) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
6. Peanut Butter Breath (hybrid) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
7. Strawberry Banana (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
8. Tahoe OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
9. Grape Ape (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
10. Alien OG (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
11. Lemon Cherry Gelato (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
12. ZaZa (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Tingly
13. Cherry Gelato (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
14. Papaya (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Hungry
15. Motorbreath (indica) — current effects: Relaxed, Sleepy, Happy, Hungry, Euphoric
16. Hawaiian (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
17. Laughing Buddha (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Giggly
18. Khalifa Kush (indica) — current effects: Happy, Relaxed, Euphoric, Uplifted, Focused
19. Animal Cookies (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
20. Glue Gelato (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy


---

## PASTE THIS AS ONE MESSAGE — batch 5 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Obama Runtz (hybrid) — current effects: Relaxed, Happy, Euphoric, Giggly, Uplifted
2. Pink Runtz (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
3. Gushers (hybrid) — current effects: Relaxed, Happy, Euphoric, Tingly, Sleepy
4. Fire OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
5. Super Boof (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Energetic
6. Gas Face (hybrid) — current effects: Relaxed, Happy, Euphoric, Tingly, Creative
7. Limoncello (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Focused
8. LA Kush Cake (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
9. Guava (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Talkative
10. White Cherry Gelato (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
11. Grease Monkey (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
12. Member Berry (hybrid) — current effects: Happy, Relaxed, Uplifted, Euphoric, Focused
13. Black Cherry Punch (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Tingly
14. Dolato (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
15. Zookies (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
16. Champagne Cake (hybrid) — current effects: Happy, Euphoric, Uplifted, Relaxed, Giggly
17. Space Cake (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Tingly
18. Fatso (indica) — current effects: Relaxed, Sleepy, Hungry, Happy, Euphoric
19. Pancakes (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
20. Gelonade (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative


---

## PASTE THIS AS ONE MESSAGE — batch 6 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Grandpa Larry (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
2. Georgia Pie (hybrid) — current effects: Happy, Relaxed, Uplifted, Euphoric, Creative
3. Snow Cap (sativa) — current effects: Happy, Uplifted, Euphoric, Energetic, Creative
4. Blackberry Caviar (indica) — current effects: Relaxed, Happy, Sleepy, Euphoric, Tingly
5. Blueberry Caviar (sativa) — current effects: Happy, Uplifted, Euphoric, Creative, Energetic
6. Cereal A La Mode (hybrid) — current effects: Happy, Euphoric, Relaxed, Tingly, Giggly
7. Cheetah Piss (hybrid) — current effects: Happy, Uplifted, Euphoric, Focused, Talkative
8. Cinnamon Milk (hybrid) — current effects: Euphoric, Relaxed, Happy, Uplifted, Tingly
9. Hollywood (hybrid) — current effects: Happy, Euphoric, Relaxed, Creative, Uplifted
10. London Pound Cake #75 (indica) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
11. Triple Scoop (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Creative
12. Apples and Bananas (hybrid) — current effects: Happy, Euphoric, Uplifted, Relaxed, Creative
13. Collins Ave (hybrid) — current effects: Euphoric, Relaxed, Happy, Uplifted, Tingly
14. The Soap (hybrid) — current effects: Happy, Euphoric, Focused, Energetic, Uplifted
15. Sticky Buns (hybrid) — current effects: Happy, Creative, Euphoric, Relaxed, Energetic
16. Sweet Tea (sativa) — current effects: Energetic, Focused, Uplifted, Happy, Euphoric
17. Pruno (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Tingly
18. Sweet & Sour (hybrid) — current effects: Relaxed, Happy, Euphoric, Focused, Uplifted
19. Long Island (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Giggly
20. Pomegranate Shake (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry


---

## PASTE THIS AS ONE MESSAGE — batch 7 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Ridgeline Lantz (hybrid) — current effects: Happy, Euphoric, Creative, Uplifted, Relaxed
2. Tequila Sunrise (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
3. Atomic Apple (indica) — current effects: Relaxed, Euphoric, Happy, Uplifted, Sleepy
4. Baklava (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
5. Kryptidz (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed
6. XJ-13 (sativa) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
7. Chrome (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed
8. Gelato 41 (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
9. Super Mango Haze (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
10. Honey Dew (hybrid) — current effects: Happy, Relaxed, Uplifted, Giggly, Euphoric
11. Orange Zkittlez (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
12. Kaleidoscope (hybrid) — current effects: Happy, Euphoric, Creative, Uplifted, Relaxed
13. Lemon Fruz (sativa) — current effects: Happy, Uplifted, Euphoric, Creative, Energetic
14. Permanent Fumes (indica) — current effects: Relaxed, Euphoric, Happy, Sleepy, Tingly
15. Flaming Cherries (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Energetic
16. Mega Z Red (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
17. Coconut Milk (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Creative
18. Scottie's Cake (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
19. Baby Joker (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed
20. Rainbow Beltz (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Giggly


---

## PASTE THIS AS ONE MESSAGE — batch 8 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Zkittlez Pie (indica) — current effects: Relaxed, Happy, Euphoric, Uplifted, Sleepy
2. Nimbus Plum (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Tingly
3. Sherbnado (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Giggly
4. Tropic Thunder (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
5. Zuava (hybrid) — current effects: Happy, Uplifted, Euphoric, Creative, Relaxed
6. Astroid Belts (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Energetic
7. Nerdz (hybrid) — current effects: Happy, Euphoric, Uplifted, Giggly, Creative
8. Space Mintz (hybrid) — current effects: Happy, Euphoric, Relaxed, Creative, Uplifted
9. Delirium (sativa) — current effects: Happy, Euphoric, Uplifted, Energetic, Creative
10. Gushmints (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Tingly
11. Melted Strawberries (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Giggly
12. Stadanko (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
13. Zlurpees (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
14. Palo Cedro (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
15. Swaggy Kush (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
16. Banga (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Energetic
17. Melon Mimosa (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
18. Hawaiian Snow (sativa) — current effects: Happy, Energetic, Uplifted, Euphoric, Creative
19. Motorberry (hybrid) — current effects: Relaxed, Happy, Euphoric, Uplifted, Tingly
20. Sour Mochi (hybrid) — current effects: Happy, Euphoric, Uplifted, Creative, Relaxed


---

## PASTE THIS AS ONE MESSAGE — batch 9 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Pink Lemon x Tropaya (sativa) — current effects: Happy, Uplifted, Euphoric, Creative, Energetic
2. All Gas No Brakes (sativa) — current effects: Energetic, Happy, Uplifted, Euphoric, Focused
3. Oakstradam OG (indica) — current effects: Relaxed, Happy, Euphoric, Sleepy, Hungry
4. Blue Andes (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
5. Z41 (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Giggly
6. Mars OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric, Hungry
7. Blueberry Poptarts (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Giggly
8. 06 OG (indica) — current effects: Relaxed, Sleepy, Happy, Hungry, Euphoric
9. 24K (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Creative
10. Black Orchid (indica) — current effects: Relaxed, Sleepy, Euphoric, Happy
11. Blackberry Kush (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric
12. Blue Cookies (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
13. Blueberry Haze (sativa) — current effects: Uplifted, Happy, Creative, Energetic, Euphoric
14. Brain Wash (hybrid) — current effects: Relaxed, Euphoric, Happy, Focused, Creative
15. Cobra Chi (hybrid) — current effects: Happy, Relaxed, Euphoric, Creative, Uplifted
16. Cream OG (indica) — current effects: Relaxed, Sleepy, Happy, Euphoric
17. Dark Web (hybrid) — current effects: Relaxed, Euphoric, Focused, Happy, Uplifted
18. Frostbite (hybrid) — current effects: Relaxed, Euphoric, Happy, Sleepy
19. Fruit Juice (sativa) — current effects: Energetic, Happy, Uplifted, Creative, Euphoric
20. Gelatti (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted


---

## PASTE THIS AS ONE MESSAGE — batch 10 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Ghost OG (indica) — current effects: Relaxed, Euphoric, Happy, Sleepy
2. Horchata (hybrid) — current effects: Relaxed, Happy, Euphoric, Creative, Focused
3. Gush Mintz (hybrid) — current effects: Euphoric, Relaxed, Happy, Uplifted, Creative
4. Headbanger (sativa) — current effects: Energetic, Euphoric, Focused, Happy, Creative
5. Mule Fuel (indica) — current effects: Relaxed, Sleepy, Euphoric, Happy
6. Nightshade (indica) — current effects: Sleepy, Relaxed, Euphoric, Happy
7. Original Glue (hybrid) — current effects: Relaxed, Euphoric, Happy, Sleepy, Hungry
8. Permanent Marker (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Focused
9. SFV OG (indica) — current effects: Relaxed, Euphoric, Happy, Sleepy
10. Strawnana (hybrid) — current effects: Happy, Relaxed, Euphoric, Creative, Uplifted
11. Sugar Cane (sativa) — current effects: Energetic, Happy, Uplifted, Euphoric, Creative
12. Gaslato (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
13. Gascotti (hybrid) — current effects: Euphoric, Relaxed, Happy, Focused, Creative
14. Jack Z (sativa) — current effects: Energetic, Euphoric, Happy, Creative, Focused
15. Pebble Beach (hybrid) — current effects: Relaxed, Euphoric, Happy, Creative
16. Wave Runner (hybrid) — current effects: Euphoric, Happy, Relaxed, Uplifted, Creative
17. Wavvyland (hybrid) — current effects: Happy, Relaxed, Euphoric, Creative, Uplifted
18. Zelium (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Focused
19. Lemon Diesel (sativa) — current effects: Energetic, Uplifted, Happy, Focused, Creative
20. Lemon Freeze Pop (hybrid) — current effects: Happy, Euphoric, Relaxed, Uplifted, Creative


---

## PASTE THIS AS ONE MESSAGE — batch 11 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Pink Lemonade (hybrid) — current effects: Uplifted, Happy, Euphoric, Creative, Relaxed
2. Thai OG (sativa) — current effects: Energetic, Euphoric, Creative, Happy, Focused
3. Zowahh (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
4. Smacks (hybrid) — current effects: Euphoric, Happy, Relaxed, Uplifted, Creative
5. UFOreoz (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Focused
6. Yellow Diamonds (hybrid) — current effects: Euphoric, Happy, Uplifted, Creative, Relaxed
7. Sweetiez (hybrid) — current effects: Happy, Relaxed, Euphoric, Creative, Uplifted
8. Space Face (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
9. Trop Cherry (hybrid) — current effects: Happy, Euphoric, Uplifted, Relaxed, Creative
10. Z Animal #10 (hybrid) — current effects: Relaxed, Euphoric, Happy, Sleepy
11. Zion OG (indica) — current effects: Relaxed, Sleepy, Euphoric, Happy
12. Watermelon Z (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
13. LCG (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
14. LCG x Z (hybrid) — current effects: Euphoric, Happy, Relaxed, Uplifted, Creative
15. Pandora's Box (sativa) — current effects: Energetic, Euphoric, Creative, Focused, Uplifted
16. Gelato 33 (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
17. Strawberry Guava (hybrid) — current effects: Happy, Relaxed, Euphoric, Creative, Uplifted
18. XXX Runtz (hybrid) — current effects: Euphoric, Relaxed, Happy, Creative, Uplifted
19. LCG x Biscotti (hybrid) — current effects: Euphoric, Relaxed, Happy, Focused, Creative
20. Rainbow Runtz (hybrid) — current effects: Euphoric, Happy, Relaxed, Uplifted, Creative


---

## PASTE THIS AS ONE MESSAGE — batch 12 of 12

You are a cannabis strain reference assistant. Return ONLY a JSON array (no prose,
no markdown fences) of objects exactly shaped like:
[{ "name": "<exact name as given>", "genetics": "<Parent A × Parent B>" | null,
   "terpenes": ["Myrcene","Limonene"], "effects": ["Relaxed"], "source": "<e.g. Leafly>" }]

RULES (important):
- Only include facts that are widely documented. If unsure, use null or []. Never guess.
- genetics: the lineage cross as "A × B" (or null). No sentences.
- terpenes: ONLY names from this list, no percentages:
  Myrcene, Limonene, Caryophyllene, Pinene, Alpha-Pinene, Beta-Pinene, Linalool, Terpinolene, Humulene, Ocimene, Terpineol, Bisabolol, Nerolidol, Camphene, Guaiol, Valencene, Eucalyptol, Geraniol, Phellandrene, Carene, Sabinene, Fenchol, Borneol, Pulegone
- effects: ONLY from this list:
  Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Talkative, Giggly, Sleepy, Hungry, Tingly
- NO medical or health claims anywhere — no conditions, no "helps/treats/relieves".
  Vibe/effect words only.
- Return one object per strain, in the same order. Output the JSON array only.

STRAINS:
1. Tropical Zkittlez (hybrid) — current effects: Happy, Relaxed, Euphoric, Uplifted, Creative
2. Super Runtz x GM (hybrid) — current effects: Euphoric, Relaxed, Happy, Uplifted
