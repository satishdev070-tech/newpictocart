/**
 * Curated Unsplash stock photos for store themes, per photo category and image slot. PURE (no
 * server-only): used by the storefront renderer, the marketplace mockups and the Media Library.
 *
 * Every entry is a real images.unsplash.com photo with its photographer, picked from Unsplash
 * search (free licence only) for the queries in STOCK_QUERIES. src/lib/unsplash.ts can refresh a
 * slot from the Search API when UNSPLASH_ACCESS_KEY is set; this list is the always-available
 * fallback, so themes never show grey boxes. Credit must be shown ("Photo: Name / Unsplash").
 */
import type { UnsplashCategory } from "./unsplash-categories";

export const STOCK_SLOTS = ["hero", "story", "tiles", "products"] as const;
export type StockSlot = (typeof STOCK_SLOTS)[number];

/** [photo id (after "photo-"), photographer name, Unsplash username, alt text]. */
type Row = readonly [string, string, string, string];

/** Search queries the pool was picked with (also used for live API refreshes). */
export const STOCK_QUERIES: Record<UnsplashCategory, Record<StockSlot, string>> = {
  fashion: { hero: "fashion model editorial", story: "tailor sewing studio", tiles: "clothing rack boutique", products: "folded clothes" },
  food: { hero: "bakery croissant", story: "baker kneading dough", tiles: "cake pastry dessert", products: "bakery display bread" },
  jewellery: { hero: "gold necklace", story: "gold jewellery box", tiles: "rings earrings jewellery", products: "gold ring" },
  beauty: { hero: "skincare products", story: "cosmetics flat lay", tiles: "lipstick makeup", products: "serum bottle" },
  furniture: { hero: "sofa living room", story: "woodworking workshop", tiles: "bedroom interior", products: "armchair" },
  electronics: { hero: "headphones", story: "circuit board", tiles: "smartphone laptop desk", products: "smartwatch" },
  handicrafts: { hero: "handmade pottery", story: "weaving loom", tiles: "woven baskets", products: "ceramic vase" },
  books: { hero: "bookshop", story: "reading book coffee", tiles: "library shelves", products: "book stack" },
  fitness: { hero: "gym floor barbell equipment", story: "group fitness class studio", tiles: "kettlebell gym equipment", products: "dumbbells weight rack" },
  toys: { hero: "kids toys colorful", story: "child playing blocks", tiles: "teddy bear", products: "wooden toys" },
  stationery: { hero: "stationery flat lay", story: "notebook pen desk", tiles: "planner journal", products: "fountain pen" },
  pets: { hero: "happy dog", story: "cat portrait", tiles: "pet toys", products: "dog bowl" },
  organic: { hero: "fresh vegetables", story: "farmer field", tiles: "spices market", products: "fruit basket" },
  art: { hero: "art gallery", story: "painter studio", tiles: "abstract painting", products: "framed art print" },
  services: { hero: "small business owner", story: "team meeting office", tiles: "consultation workspace", products: "laptop workspace" },
  general: { hero: "shopping bags", story: "retail store interior", tiles: "gift box", products: "product packaging" },
};

const POOL: Record<UnsplashCategory, Record<StockSlot, readonly Row[]>> = {
  fashion: {
    hero: [
      ["1613915617430-8ab0fd7c6baf", "Chyntia Juls", "chyntiajuls", "A person in a blazer and trousers"],
      ["1664076458686-3449062080ac", "Lauro Rodríguez", "lgrt", "A woman in a flowing dress"],
      ["1668952135120-7d997b1b3778", "Onur Senay", "onurssenay", "A woman in a long coat"],
    ],
    story: [
      ["1673201229733-69d19c5c4a87", "Collab Media", "collab_media", "A woman sewing clothes on a machine"],
      ["1578353022142-09264fd64295", "Darling Arias", "darlingarias", "Thread spools beside scissors"],
    ],
    tiles: [
      ["1441984904996-e0b6ba687e04", "Clark Street Mercantile", "mercantile", "Clothing boutique with hanging racks"],
      ["1532453288672-3a27e9be9efd", "Marcus Loke", "marcusloke", "Colourful shirts on a rack"],
      ["1582719188393-bb71ca45dbb9", "Markus Winkler", "markuswinkler", "Rows of colourful sweaters on hangers"],
      ["1558769132-cb1aea458c5e", "Alyssa Strohmann", "anotherlovely", "A top hanging on a clothes horse"],
    ],
    products: [
      ["1562157873-818bc0726f68", "Md Salman", "mohammadsalman", "Folded shirts in many colours"],
      ["1567113463300-102a7eb3cb26", "Sarah Brown", "sweetpagesco", "Folded apparel in soft colours"],
      ["1604176354204-9268737828e4", "Maude Frédérique Lavoie", "maudefl", "A white cable-knit sweater"],
      ["1504198458649-3128b932f49e", "Sarah Dorweiler", "sarahdorweiler", "Folded black, white and grey textiles"],
    ],
  },
  food: {
    hero: [
      ["1623334044303-241021148842", "Conor Brown", "commonboxturtle", "Croissants on a table"],
      ["1483695028939-5bb13f8648b0", "Mink Mingle", "minkmingle", "Baked treats on a tray"],
      ["1555507036-ab1f4038808a", "Mae Mu", "picoftasty", "Two golden croissants"],
    ],
    story: [
      ["1517686469429-8bdb88b9f907", "Nadya Spetnitskaya", "kiboka", "Making dough with a rolling pin"],
      ["1652283321082-72bb2b601abd", "Skyler Ewing", "skylerewing", "Kneading a ball of dough"],
    ],
    tiles: [
      ["1583338917451-face2751d8d5", "Ulysse Pointcheval", "ulysse_pcl", "Fruit tarts and chocolate cakes"],
      ["1530648672449-81f6c723e2f1", "Gaby Dyson", "gdyson", "Strawberry pastries on a platter"],
      ["1469533778471-92a68acc3633", "Brina Blum", "brina_blum", "Blueberry cupcakes"],
      ["1595144780677-6d0b5abbd089", "sera", "sserass", "Chocolate cupcakes on a shelf"],
    ],
    products: [
      ["1599940778173-e276d4acb2bb", "Jocelyn Morales", "molnj", "Bread on a ceramic plate"],
      ["1760986788194-e22813c56a11", "Nik", "helloimnik", "Fresh bread and pastries on display"],
      ["1691480162735-9b91238080f6", "personalgraphic.com", "personal_graphic", "A croissant on a white surface"],
      ["1776847382319-7ed1a43eab04", "Phillip Flores", "pflores", "Bakery case with pastries and bread"],
    ],
  },
  jewellery: {
    hero: [
      ["1722410180687-b05b50922362", "PRAHANT STUDIO", "prahantstudio", "A necklace and earrings on a display bust"],
      ["1783541507490-edb026e2a961", "Paul Lora", "dream_land_oficial", "Gold necklace with an oval pendant"],
      ["1620656798579-1984d9e87df7", "Eric Fung", "eclf", "A woman wearing a gold necklace"],
    ],
    story: [
      ["1682823544433-aae34df4e3da", "Nataliia Hordiiuk", "whynotnatali", "Gold jewellery in a white box"],
      ["1771734065116-61e16b353ded", "Andrey Ilkevich", "ilkevich", "A gold chain on black"],
    ],
    tiles: [
      ["1543294001-f7cd5d7fb516", "Cornelia Ng", "corneliang", "Three gold studded rings"],
      ["1601121141461-9d6647bca1ed", "Vaibhav Nagare", "vaibhavnagare", "Gold and purple beaded necklace"],
      ["1608042314453-ae338d80c427", "Luisana Galicia", "luisanagalicia", "Gold and red beaded bracelet"],
      ["1561828995-aa79a2db86dd", "Tessa Edmiston", "thewildflowerpress", "Gold jewellery pieces"],
    ],
    products: [
      ["1622398925373-3f91b1e275f5", "Mariano Rivas", "colormono", "Two interlocking gold bands"],
      ["1598560917807-1bae44bd2be8", "Sabrianna", "sabrinnaringquist", "A gold ring on white"],
      ["1631982690223-8aa4be0a2497", "JESUS ECA", "jesus_eca", "Three gold rings in a box"],
      ["1611107683227-e9060eccd846", "Syed F Hashemi", "sfhashemi", "Gold chain necklace on white"],
    ],
  },
  beauty: {
    hero: [
      ["1580870069867-74c57ee1bb07", "Valeriia Miller", "valeriiamiller", "Four skincare products arranged together"],
      ["1608571423902-eed4a5ad8108", "Kadarius Seegars", "kseegars", "An amber dropper bottle on a wooden stand"],
      ["1552046122-03184de85e08", "Toa Heftiba", "heftiba", "A hand reaching for a jar of cream"],
    ],
    story: [
      ["1569385210018-127685230669", "Tusik Only", "tusik", "Flat lay of a cosmetic kit"],
      ["1619451427882-6aaaded0cc61", "Nataliya Melnychuk", "natinati", "Hands applying lotion"],
    ],
    tiles: [
      ["1631214499500-2e34edcaccfe", "Ashley Piszek", "missswiss", "Lipstick swatches in warm shades"],
      ["1596690636757-2b945da88bcc", "Karly Jones", "earthtokarly", "Red lipstick on textile"],
      ["1602558618194-3037081afe0d", "Nick Noel", "nickelinanoel", "Black and pink lipstick"],
      ["1585945037805-5fd82c2e60b1", "Kelsey Curtis", "kelseycurtis", "A smear of cream on beige"],
    ],
    products: [
      ["1671493235081-5842463637cd", "Denise Chan", "elchan", "An essential oil bottle on cloth"],
      ["1713768704571-6aeb0d0e5105", "Point Normal", "normals", "A dropper bottle on yellow"],
      ["1620916297397-a4a5402a3c6c", "Mathilde Langevin", "mathildelangevin", "A black glass bottle in hand"],
      ["1696025522422-aa9a74e4f3d5", "Sanju Pandita", "spxclicks", "A serum bottle on a rock"],
    ],
  },
  furniture: {
    hero: [
      ["1759722665629-29df6ee4f9a5", "Costa Live", "vendedorescostalive", "A light grey sofa in a modern living room"],
      ["1590251024078-8a6d9f90b02d", "Lisa Amann", "lisaamann", "A dark green sofa with striped cushions"],
      ["1653340513561-3ef95d9e4d94", "Omar Shabana", "shabna_ko", "A living room with large windows"],
    ],
    story: [
      ["1631396326838-de37e5f8bcbc", "Bailey Alexander", "baileyal3xander", "A man working on a piece of wood"],
      ["1788296817269-8df0458ab799", "HENG YIN", "maple_yin", "Woodworking tools on a workbench"],
    ],
    tiles: [
      ["1616594039964-ae9021a400a0", "Spacejoy", "spacejoy", "A modern bedroom with an upholstered bed"],
      ["1616047006789-b7af5afb8c20", "Spacejoy", "spacejoy", "Living room with a leather sectional sofa"],
      ["1616486029423-aaa4789e8c9a", "Spacejoy", "spacejoy", "A bedroom with a leather bench"],
      ["1597960194599-22929afc25b1", "Devin Berko", "devinnn_b", "A wooden dining table with chairs"],
    ],
    products: [
      ["1586023492125-27b2c045efd7", "Kam Idris", "ka_idris", "A yellow padded armchair"],
      ["1580480055273-228ff5388ef8", "SCOPIC LTD", "scopicltd", "A grey padded wooden chair"],
      ["1567538096630-e0c55bd6374c", "Daniil Silantev", "betagamma", "A tufted white leather chair"],
      ["1634712282287-14ed57b9cc89", "Virender Singh", "virender833", "A blue chair and a yellow lamp"],
    ],
  },
  electronics: {
    hero: [
      ["1505740420928-5e560c06d30e", "C D-X", "cdx2", "Wireless headphones on a flat background"],
      ["1546435770-a3e426bf472b", "Tomasz Gawłowski", "gawlowski", "Headphones beside a keyboard"],
      ["1618366712010-f4ae9c647dcb", "Luke Peterson", "ldpeterson11", "Black wireless headphones on a table"],
    ],
    story: [
      ["1518770660439-4636190af475", "Alexandre Debiève", "alexkixa", "Macro shot of a circuit board"],
      ["1592659762303-90081d34b277", "Vishnu Mohanan", "vishnumaiea", "Dark blue circuit board"],
    ],
    tiles: [
      ["1511707171634-5f897ff02aa9", "Rahul Chakraborty", "hckmstrrahul", "A smartphone with a colourful screen"],
      ["1499750310107-5fef28a66643", "Andrew Neel", "andrewtneel", "A laptop, mug and phone on a desk"],
      ["1426024084828-5da21e13f5dc", "Firmbee.com", "firmbee", "Laptop beside a tablet and phone"],
      ["1545127398-14699f92334b", "Alexunder Hess", "alexunderhess", "Gold wireless headphones"],
    ],
    products: [
      ["1579586337278-3befd40fd17a", "Simon Daoudi", "sdaoudi", "A smartwatch with a textured band"],
      ["1546868871-7041f2a55e12", "Daniel Korpai", "danielkorpai", "Space grey smartwatch"],
      ["1613040809024-b4ef7ba99bc3", "Ervo Rocks", "ervorocks", "Pink and white headphones"],
      ["1641048930621-ab5d225ae5b0", "Cosmin Ursea", "cosminursea", "Headphones on a table"],
    ],
  },
  handicrafts: {
    hero: [
      ["1595351298020-038700609878", "Taylor Heery", "taylorheeryphoto", "Shaping clay on a pottery wheel"],
      ["1597696929736-6d13bed8e6a8", "Chloe Bolton", "crystalmind_design", "Ceramic vases in neutral tones"],
      ["1609881583302-61548332039c", "Earl Wilcox", "earl_plannerzone", "Making a clay pot"],
    ],
    story: [
      ["1643766883805-829d9ad95c42", "Mick Haupt", "rocinante_11", "A colourful weaving loom"],
      ["1786130605731-e14c697ae014", "Anastasiia Grigorev", "nasya_snap", "Weaving a wicker basket outdoors"],
    ],
    tiles: [
      ["1679958854536-a1bb774ef8ab", "Wan Salahuddin Wan Ismail", "udeyismail", "A pile of woven baskets"],
      ["1758784881676-68e4b9e26da2", "Kamaruld Salleh", "ks_works", "Woven baskets with colourful ropes"],
      ["1631125915902-d8abe9225ff2", "Yana Hurska", "yana_hurska", "Three clay vases"],
      ["1590605095243-072811dbe64c", "Courtney Cook", "courtneymcook", "Holding a white clay pot"],
    ],
    products: [
      ["1612196808214-b8e1d6145a8c", "Mathilde Langevin", "mathildelangevin", "A white ceramic vase on wood"],
      ["1660721671073-e139688fa3cf", "OMK", "whyomywhy", "A stack of bowls and a vase"],
      ["1677761640321-b80251be00ca", "Tamara Harhai", "toma_ha", "Two vases on a table"],
      ["1607556671927-78a6605e290b", "Earl Wilcox", "earl_plannerzone", "A clay pot on a wheel"],
    ],
  },
  books: {
    hero: [
      ["1532012197267-da84d127e765", "Jaredd Craig", "jaredd", "An open book above stacked books"],
      ["1513185041617-8ab03f83d6c5", "Rey Seven", "rey_7", "Old brown books"],
      ["1518373714866-3f1478910cc0", "John Michael Thomson", "svqmedia", "A woman in a library looking at books"],
    ],
    story: [
      ["1542372147193-a7aca54189cd", "Rizky Subagja", "subagjav", "Latte, croissant and book on a café table"],
      ["1588666309990-d68f08e3d4a6", "Julia Kicova", "justjullietta", "An open book, coffee and flowers"],
    ],
    tiles: [
      ["1603058817990-2b9a9abbce86", "Eilis Garvey", "eilisgarvey", "A wooden bookshelf with books"],
      ["1758801966638-dfd34dae251c", "Declan Sun", "declansun", "Curved wooden bookshelves"],
      ["1709924168698-620ea32c3488", "Jayanth Muppaneni", "jay_5", "Long rows of bookshelves"],
      ["1741708011297-a364acd23638", "Zoshua Colah", "zoshuacolah", "Books on a large wooden bookshelf"],
    ],
    products: [
      ["1610116306796-6fea9f4fae38", "Gülfer ERGİN", "gulfergin_01", "A pile of open paperbacks"],
      ["1457369804613-52c61a468e7d", "Patrick Tomasso", "impatrickt", "Open books"],
      ["1524995997946-a1c2e315a42f", "Susan Q Yin", "syinq", "Books on a wooden shelf"],
      ["1497633762265-9d179a990aa6", "Kimberly Farmer", "kimberlyfarmer", "Stacked books in soft focus"],
    ],
  },
  fitness: {
    hero: [
      ["1517836357463-d25dfeac3438", "Victor Freitas", "victorfreitas", "About to lift a barbell"],
      ["1534438327276-14e5300c3a48", "Victor Freitas", "victorfreitas", "Dumbbells on a rack in a gym"],
      ["1571902943202-507ec2618e8f", "Sven Mieke", "svenmieke", "Empty gym floor with machines"],
      ["1761839258420-5c3e2f2e2a74", "Land O'Lakes, Inc.", "landolakesinc", "A woman lifting weights in a gym"],
      ["1526506118085-60ce8714f8c5", "Edgar Chaparro", "echaparro", "A man working out"],
      ["1540497077202-7c8a3999166f", "Jonathan Borba", "jonathanborba", "People training in a gym"],
    ],
    story: [
      ["1552196563-55cd4e45efb3", "Dane Wetton", "danewett", "A woman doing yoga"],
      ["1518611012118-696072aa579a", "Bruce Mars", "brucemars", "Group fitness class stretching"],
      ["1571019614242-c5c5dee9f50b", "Alora Griffiths", "aloragriffiths", "Trainer coaching a client"],
      ["1646239646963-b0b9be56d6b5", "Samantha Sheppard", "samsheppardphoto", "A yoga mat with two blocks"],
    ],
    tiles: [
      ["1517963879433-6ad2b756fd75", "Victor Freitas", "victorfreitas", "Kettlebells lined up on a gym floor"],
      ["1434682881908-b43d0467b798", "John Arano", "johnarano", "Barbell plates stacked in a gym"],
      ["1599058945522-28d584b6f14f", "Anastase Maragos", "visuals", "Row of treadmills in a gym"],
      ["1542291026-7eec264c27ff", "Ryan Waring", "ryanwaring", "A red running shoe"],
      ["1571008887538-b36bb32f4571", "sporlab", "sporlab", "Blue and white running shoes"],
      ["1599901860904-17e6ed7083a0", "Ginny Rose Stewart", "ginnyrose", "Stretching on a mat"],
    ],
    products: [
      ["1576678927484-cc907957088c", "Samuel Girven", "samuelgirven", "Dumbbells on a rack"],
      ["1703668984128-b506579acdd2", "Blend Archive", "blendarchive", "A pair of dumbbells on a table"],
      ["1517838277536-f5d99bf86ca6", "Victor Freitas", "victorfreitas", "Barbell loaded with weight plates"],
      ["1581009146145-b5ef050c2e1e", "Anastase Maragos", "visuals", "Resistance bands and gym accessories"],
      ["1606107557195-0e29a4b5b4aa", "USAMA AKRAM", "usama_1248", "A green and black athletic shoe"],
      ["1560769629-975ec94e6a86", "Irene Kredenets", "ikredenets", "White and orange athletic shoes"],
    ],
  },
  toys: {
    hero: [
      ["1545558014-8692077e9b5c", "Vanessa Bucceri", "vbcreative", "Colourful learning toys"],
      ["1655087751207-1020c89f7eee", "sheilabox", "sheilabox", "A group of colourful toys"],
      ["1741389544696-0750a7ac6bbb", "Mirna Wabi-Sabi", "mirnawabisabi", "Toys in a shop window"],
    ],
    story: [
      ["1484820540004-14229fe36ca4", "Markus Spiske", "markusspiske", "A child stacking colourful blocks"],
      ["1485783522162-1dbb8ffcbe5b", "Kelly Sikkema", "kellysikkema", "Toddlers playing with building blocks"],
    ],
    tiles: [
      ["1602734846297-9299fc2d4703", "Carter Baran", "carterbaran", "A teddy bear with a bow tie"],
      ["1618842676088-c4d48a6a7c9d", "Tomáš Petz", "pecmen", "A colourful plastic toy"],
      ["1560859251-d563a49c5e4a", "Baby Natur", "babynatur", "Toy racing cars"],
      ["1536293182766-c9c0c4133b55", "Max Di Capua", "maxdicapua", "A rainbow clay toy"],
    ],
    products: [
      ["1703581698778-2224c729135b", "Geoff Oliver", "satsuma9", "Three wooden elephants"],
      ["1556012018-50c5c0da73bf", "Sandy Millar", "sandym10", "A brown teddy bear"],
      ["1652501595862-1d06fe543544", "Izabelly Marques", "izamarques", "A stuffed bear with a green bow"],
      ["1611957082141-c449bb2b4ada", "luis arias", "luis_arias", "A game of chess"],
    ],
  },
  stationery: {
    hero: [
      ["1526280524276-51b1c8a46321", "Jess Bailey", "jessbaileydesigns", "Pens beside a notebook"],
      ["1514809606235-a56fe6d553b4", "Joanna Kosinska", "joannakosinska", "Flowers on a card near a pencil"],
      ["1435527173128-983b87201f4d", "Eric Rothermel", "erothermel", "An open planner on a wooden desk"],
    ],
    story: [
      ["1471107340929-a87cd0f5b5f3", "Aaron Burden", "aaronburden", "A fountain pen on a notebook"],
      ["1612367980327-7454a7276aa7", "Kelly Sikkema", "kellysikkema", "A spiral notebook on a wooden table"],
    ],
    tiles: [
      ["1506784983877-45594efa4cbe", "Estée Janssens", "esteejanssens", "A coffee mug on a planner"],
      ["1513128034602-7814ccaddd4e", "Marissa Grootes", "marissacristina", "Notepad and pen flat lay"],
      ["1632772998001-cc9bf6f7c852", "2H Media", "2hmedia", "A planner with two pens"],
      ["1483546416237-76fd26bbcdd1", "Jan Kahánek", "honza_kahanek", "A pencil on a book"],
    ],
    products: [
      ["1518674660708-0e2c0473e68e", "Art Lasovsky", "artlasovsky", "A gold fountain pen"],
      ["1455390582262-044cdead277a", "Aaron Burden", "aaronburden", "A fountain pen on lined paper"],
      ["1473186505569-9c61870c11f9", "Álvaro Serrano", "alvaroserrano", "A black and silver fountain pen"],
      ["1620275765334-4ed948bb4502", "Justin Morgan", "justin_morgan", "A pen on a white notebook"],
    ],
  },
  pets: {
    hero: [
      ["1552053831-71594a27632d", "Richard Brutyo", "richardbrutyo", "A Labrador holding a tulip"],
      ["1530281700549-e82e7bf110d6", "Oscar Sutton", "o5ky", "A dog running on a beach"],
      ["1543466835-00a7907e9de1", "Milli", "marliesestreefland", "A dog's face up close"],
    ],
    story: [
      ["1536589961747-e239b2abbec2", "Zoë Gayah Jonker", "zoegayah", "A white and brown cat"],
      ["1764708844823-00d2188dafd8", "Jonathan Ikemura", "ikemura", "A fluffy cat by a sunny window"],
    ],
    tiles: [
      ["1591946614720-90a587da4a36", "FLOUFFY", "theflouffy", "A golden retriever holding a toy"],
      ["1568640347023-a616a30bc3bd", "okeykat", "okeykat", "Bone-shaped dog treats"],
      ["1535294435445-d7249524ef2e", "Chris Jarvis", "hypethat", "A red chew toy"],
      ["1559624989-7b9303bd9792", "Zane Lee", "zane404", "A tabby cat on a beam"],
    ],
    products: [
      ["1714068691210-073dc52c6c1d", "Ayla Verschueren", "moob", "A dog eating from a bowl"],
      ["1679224106783-c21b1841412a", "Koa'link", "koalink", "A dog bowl with paw prints"],
      ["1591946559594-8c6d3b7391eb", "FLOUFFY", "theflouffy", "A dog beside an empty bowl"],
      ["1598134493136-7b63ebbd7b64", "Karsten Winegeart", "_karsten", "A French bulldog in a bucket"],
    ],
  },
  organic: {
    hero: [
      ["1579113800032-c38bd7635818", "Marisol Benitez", "marisolbenitez", "A pile of fresh vegetables"],
      ["1610348725531-843dff563e2c", "engin akyurt", "enginakyurt", "Fresh fruits and vegetables"],
      ["1590779033100-9f60a05a013d", "Nathan Dumlao", "nate_dumlao", "Broccoli, peppers and fresh vegetables"],
    ],
    story: [
      ["1620901433789-1d2f85a93653", "Saikiran Kesari", "saikirankesari", "A farmer ploughing with two oxen"],
      ["1530507629858-e4977d30e9e0", "Nandhu Kumar", "nandhukumarndd", "A woman harvesting rice"],
    ],
    tiles: [
      ["1525289722380-f5bf1653d504", "Paolo Bendandi", "paolobendandi", "Assorted spices"],
      ["1663325265966-0d17de3e85c5", "Mohammad Mardani", "mmdam20", "Bowls full of spices"],
      ["1566824099147-bef027d3a333", "Nikoli Afina", "afinika", "Herbs in sacks"],
      ["1774712471470-5aa92dfc94ae", "Judith Chambers", "mzkleen", "Rows of colourful bell peppers"],
    ],
    products: [
      ["1619566636858-adf3ef46400b", "Jonas Kakaroto", "jkakaroto", "A basket of fresh fruit"],
      ["1629905707362-03cf1a9f6e2d", "Nataliya Melnychuk", "natinati", "Red apples in a woven basket"],
      ["1586099529369-00432c0492cd", "Powell Rasull", "rasull", "Red apples and yellow fruit"],
      ["1609780447631-05b93e5a88ea", "Alexander Schimmeck", "alschim", "A market stall of fresh produce"],
    ],
  },
  art: {
    hero: [
      ["1518998053901-5348d3961a04", "Dannie Jing", "dannie_jing", "Paintings on a white wall"],
      ["1554907984-15263bfd63bd", "Andrew Neel", "andrewtneel", "Picture frames on a wall"],
      ["1606819717115-9159c900370b", "Zalfa Imani", "zalfaimani", "Standing in front of paintings"],
    ],
    story: [
      ["1613746203812-717e6e5db3da", "laura adai", "lauraadaiphoto", "Paint brushes in a glass jar"],
      ["1740710543611-80b658171bc3", "Ashe Walker", "marsupialpudding", "A studio with an easel and brushes"],
    ],
    tiles: [
      ["1615184697985-c9bde1b07da7", "Mayur Deshpande", "mayur_deshpande", "Blue, yellow and red abstract painting"],
      ["1605721911519-3dfeb3be25e7", "Jené Stephaniuk", "jenestephaniuk", "Red, blue and yellow abstract painting"],
      ["1541512416146-3cf58d6b27cc", "Steve A Johnson", "steve_j", "Abstract brushstrokes"],
      ["1618331833071-ce81bd50d300", "Vojtech Bruzek", "vojtechbruzek", "Blue, white and yellow abstract painting"],
    ],
    products: [
      ["1761479373575-f32356d02f37", "Sebastian Puskeiler", "keiler", "A framed print in sunlight"],
      ["1784006322945-efad2e732845", "Lea Gindorf", "lea_gindorf", "An abstract poster on a wall"],
      ["1790847671394-3cde9da5614c", "Annie Spratt", "anniespratt", "A framed watercolour painting"],
      ["1613635423272-ef6bfd72ac0b", "Laura Cleffmann", "cloudett", "A wooden photo frame on a wall"],
    ],
  },
  services: {
    hero: [
      ["1556740758-90de374c12ad", "Blake Wisz", "blakewisz", "Two women at work in a small business"],
      ["1531058240690-006c446962d8", "Ellicia", "ellicia_", "A woman standing beside a table"],
      ["1572021335469-31706a17aaef", "Jud Mackrill", "judmackrill", "Coworkers around a laptop"],
    ],
    story: [
      ["1603201667230-bd139210db18", "Cherrydeck", "cherrydeck", "Four people collaborating around a laptop"],
      ["1630487656049-6db93a53a7e9", "Andreea Avramescu", "minakko", "People reviewing documents at a table"],
    ],
    tiles: [
      ["1780733066519-df99b3123d30", "Md Ishak Rahman", "mdishakrahman", "A consultant explaining plans"],
      ["1562564055-71e051d33c19", "Gabrielle Henderson", "gabriellefaithhenderson", "Signing papers at a desk"],
      ["1553877522-43269d4ea984", "charlesdeluvio", "charlesdeluvio", "A man using a laptop"],
      ["1681949103006-70066fb25dfe", "Sable Flow", "sableflow", "A group around a white table"],
    ],
    products: [
      ["1530893609608-32a9af3aa95c", "Austin Poon", "austinpoon", "A laptop on a desk"],
      ["1511385348-a52b4a160dc2", "James McKinven", "jmckinven", "A laptop in soft light"],
      ["1558478551-1a378f63328e", "Alexa Williams", "glamorousplanning", "A laptop on a white table"],
      ["1604074131228-9d48b811bd80", "Justus Menke", "justusmenke", "A laptop on a wooden table"],
    ],
  },
  general: {
    hero: [
      ["1483985988355-763728e1935b", "freestocks", "freestocks", "Holding paper shopping bags"],
      ["1777136977034-71cbc026c9b1", "Tim Ziegelbaum", "absun", "A modern retail display"],
      ["1789547422569-6f2b3c4498ed", "Cheung Yin", "cheungyin", "Store shelves of packaged goods"],
    ],
    story: [
      ["1777628530456-bb93d3a03faf", "Bayu Syaits", "bayusyaits", "A boutique with racks of apparel"],
      ["1534452203293-494d7ddbf7e0", "Jacek Dylag", "dylu", "A brown paper bag"],
    ],
    tiles: [
      ["1549465220-1a8b9238cd48", "Ekaterina Shevchenko", "shekatherine", "A wrapped gift box"],
      ["1513201099705-a9746e1e201f", "Jess Bailey", "jessbaileydesigns", "A gift box with a pink ribbon"],
      ["1707944145479-12755f0434d8", "Baibhav Kumar", "artvilla67", "A mint green gift box tied with twine"],
      ["1561715276-a2d087060f1d", "Lucrezia Carnelos", "ciabattespugnose", "A blue and brown tote bag"],
    ],
    products: [
      ["1617825295690-28ae56c56135", "Tarah Dane", "danesvg", "Green and pink boxes"],
      ["1595246135406-803418233494", "Mildlee", "mildlee", "A cardboard box on a table"],
      ["1774451853657-a45138796465", "Khanh Do", "donguyenkhanhs", "A white gift box with a green bow"],
      ["1648587456176-4969b0124b12", "Clair", "clair_", "A box and a cup of coffee"],
    ],
  },
};

const UTM = "utm_source=pictocart&utm_medium=referral";

export type StockImage = {
  /** Unsplash photo id ("photo-…"). */
  id: string;
  /** images.unsplash.com URL without a width; next/image (lib/images/loader) adds `w`. */
  url: string;
  alt: string;
  photographer: { name: string; url: string } | null;
  unsplashUrl: string;
  slot: StockSlot;
  category: UnsplashCategory;
  source: "api" | "fallback";
};

/** Base images.unsplash.com URL for a photo id (auto format, cropped by the layout). */
export function stockPhotoUrl(id: string): string {
  return `https://images.unsplash.com/${id.startsWith("photo-") ? id : `photo-${id}`}?auto=format&fit=crop&q=70`;
}

/** Same URL at a given width (for plain <img> uses such as the marketplace mockups). */
export const sizedStockUrl = (url: string, width: number) => `${url}${url.includes("?") ? "&" : "?"}w=${width}`;

function toImage(row: Row, slot: StockSlot, category: UnsplashCategory): StockImage {
  return {
    id: `photo-${row[0]}`,
    url: stockPhotoUrl(row[0]),
    alt: row[3],
    photographer: { name: row[1], url: `https://unsplash.com/@${row[2]}?${UTM}` },
    unsplashUrl: `https://unsplash.com/?${UTM}`,
    slot,
    category,
    source: "fallback",
  };
}

/** The curated photos for one category and slot. PURE. */
export function curatedStock(category: UnsplashCategory, slot: StockSlot): StockImage[] {
  return POOL[category][slot].map((r) => toImage(r, slot, category));
}

/** Every curated slot for a category. PURE. */
export function curatedStockSet(category: UnsplashCategory): StockSet {
  return { category, hero: curatedStock(category, "hero"), story: curatedStock(category, "story"), tiles: curatedStock(category, "tiles"), products: curatedStock(category, "products") };
}

/** A category's stock photos by slot (what a theme fills its empty image slots with). */
export type StockSet = { category: UnsplashCategory } & Record<StockSlot, StockImage[]>;

/** Deterministic pick: the n-th photo of a slot, wrapping around (so tiles and cards vary). */
export function pickStock(set: StockSet | null | undefined, slot: StockSlot, n = 0): StockImage | null {
  const list = set?.[slot];
  if (!list?.length) return null;
  return list[((n % list.length) + list.length) % list.length]!;
}

/** Stable small hash of a string (product id → placeholder photo). PURE. */
export function stockIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Unique photographers in a set, for one combined credit line. */
export function stockCredits(set: StockSet | null | undefined): { name: string; url: string }[] {
  if (!set) return [];
  const seen = new Map<string, { name: string; url: string }>();
  for (const slot of STOCK_SLOTS) for (const img of set[slot]) if (img.photographer && !seen.has(img.photographer.name)) seen.set(img.photographer.name, img.photographer);
  return [...seen.values()];
}
