interface FolderMember {
  uid: string;
  name: string;
  image: string | undefined;
}

export interface Folder {
  folder_id: string;
  name: string;
  size: number;
  members: FolderMember[];
  updated_at: string;
}

export const FoldersList: Folder[] = [
  {
    folder_id: "1",
    name: "Web Applications",
    size: 48257475840,
    members: [
      {
        uid: "1-0",
        name: "Galina Dougherty",
        image: undefined,
      },
      {
        uid: "1-1",
        name: "Berti Wrintmore",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "1-2",
        name: "Thibaud Waliszek",
        image: undefined,
      },
      {
        uid: "1-3",
        name: "Darice Melbourne",
        image: undefined,
      },
    ],
    updated_at: "11/21/2023",
  },
  {
    folder_id: "2",
    name: "Media",
    size: 16338079775,
    members: [
      {
        uid: "2-0",
        name: "Petronille Reasce",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "2-1",
        name: "Bunny Roser",
        image: "/images/avatar/avatar-9.jpg",
      },
    ],
    updated_at: "12/23/2023",
  },
  {
    folder_id: "3",
    name: "Designs",
    size: 2693727267,
    members: [
      {
        uid: "3-0",
        name: "Berton MacColgan",
        image: undefined,
      },
      {
        uid: "3-1",
        name: "Davidson Kos",
        image: "/images/avatar/avatar-13.jpg",
      },
    ],
    updated_at: "12/12/2023",
  },
  {
    folder_id: "4",
    name: "Web Applications",
    size: 45970833238,
    members: [
      {
        uid: "4-0",
        name: "Andrei Lack",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "4-1",
        name: "Isis Ovett",
        image: "/images/avatar/avatar-5.jpg",
      },
    ],
    updated_at: "11/16/2023",
  },
  {
    folder_id: "5",
    name: "Movies",
    size: 7295585474,
    members: [
      {
        uid: "5-0",
        name: "Stacee Batchley",
        image: undefined,
      },
      {
        uid: "5-1",
        name: "Willem Bimrose",
        image: undefined,
      },
      {
        uid: "5-2",
        name: "Lettie Templman",
        image: undefined,
      },
    ],
    updated_at: "11/23/2023",
  },
  {
    folder_id: "6",
    name: "Designs",
    size: 14650199496,
    members: [
      {
        uid: "6-0",
        name: "Axel Spottswood",
        image: undefined,
      },
      {
        uid: "6-1",
        name: "Charyl Rodenborch",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "6-2",
        name: "Jackson Huxton",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "6-3",
        name: "Shawna Klich",
        image: undefined,
      },
    ],
    updated_at: "11/2/2023",
  },
  {
    folder_id: "7",
    name: "Designs",
    size: 83192062143,
    members: [
      {
        uid: "7-0",
        name: "Dorelia De Goey",
        image: undefined,
      },
    ],
    updated_at: "11/9/2023",
  },
  {
    folder_id: "8",
    name: "Movies",
    size: 15664441690,
    members: [
      {
        uid: "8-0",
        name: "Brittaney Kerridge",
        image: "/images/avatar/avatar-19.jpg",
      },
    ],
    updated_at: "11/18/2023",
  },
  {
    folder_id: "9",
    name: "Backup",
    size: 92834693924,
    members: [
      {
        uid: "9-0",
        name: "Hoebart Drohan",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "9-1",
        name: "Georg De Vaux",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "9-2",
        name: "Arvin Frapwell",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "9-3",
        name: "Tamar Griffithe",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "12/4/2023",
  },
  {
    folder_id: "10",
    name: "Web Applications",
    size: 34496276030,
    members: [
      {
        uid: "10-0",
        name: "Jeremy Cumpsty",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "10-1",
        name: "Cointon McBain",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "10-2",
        name: "Toiboid Gaffey",
        image: "/images/avatar/avatar-6.jpg",
      },
    ],
    updated_at: "11/15/2023",
  },
  {
    folder_id: "11",
    name: "Backup",
    size: 3568661976,
    members: [
      {
        uid: "11-0",
        name: "Xavier Elven",
        image: undefined,
      },
      {
        uid: "11-1",
        name: "Jacintha Redrup",
        image: undefined,
      },
      {
        uid: "11-2",
        name: "Adel Broddle",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "11-3",
        name: "Nils Kinnon",
        image: undefined,
      },
    ],
    updated_at: "11/2/2023",
  },
  {
    folder_id: "12",
    name: "Web Applications",
    size: 9564173890,
    members: [
      {
        uid: "12-0",
        name: "Rebbecca Jollands",
        image: undefined,
      },
    ],
    updated_at: "12/27/2023",
  },
  {
    folder_id: "13",
    name: "Movies",
    size: 44747178760,
    members: [
      {
        uid: "13-0",
        name: "Lulita Spridgeon",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "13-1",
        name: "Harriet Oda",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "13-2",
        name: "Renato Dowrey",
        image: "/images/avatar/avatar-4.jpg",
      },
    ],
    updated_at: "11/5/2023",
  },
  {
    folder_id: "14",
    name: "Designs",
    size: 34759206818,
    members: [
      {
        uid: "14-0",
        name: "Kelcy Beeres",
        image: "/images/avatar/avatar-20.jpg",
      },
      {
        uid: "14-1",
        name: "Mina De Fries",
        image: undefined,
      },
      {
        uid: "14-2",
        name: "Eyde Brisse",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "14-3",
        name: "Arv Papen",
        image: "/images/avatar/avatar-20.jpg",
      },
      {
        uid: "14-4",
        name: "Francis Carstairs",
        image: undefined,
      },
    ],
    updated_at: "12/12/2023",
  },
  {
    folder_id: "15",
    name: "Web Applications",
    size: 71831674944,
    members: [
      {
        uid: "15-0",
        name: "Candis O'Lenane",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "15-1",
        name: "Clarie Kirgan",
        image: undefined,
      },
    ],
    updated_at: "11/17/2023",
  },
  {
    folder_id: "16",
    name: "Media",
    size: 91105981644,
    members: [
      {
        uid: "16-0",
        name: "Alano Pooly",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "16-1",
        name: "Evonne Antcliff",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "16-2",
        name: "Dan Kille",
        image: undefined,
      },
      {
        uid: "16-3",
        name: "Jessey Ghidotti",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "16-4",
        name: "Hyacinthia Meran",
        image: undefined,
      },
    ],
    updated_at: "12/25/2023",
  },
  {
    folder_id: "17",
    name: "Documents",
    size: 66607157929,
    members: [
      {
        uid: "17-0",
        name: "Ree McGeever",
        image: "/images/avatar/avatar-7.jpg",
      },
    ],
    updated_at: "11/5/2023",
  },
  {
    folder_id: "18",
    name: "Movies",
    size: 86755606880,
    members: [
      {
        uid: "18-0",
        name: "Sauncho Possek",
        image: undefined,
      },
      {
        uid: "18-1",
        name: "Joana Tugwell",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "12/11/2023",
  },
  {
    folder_id: "19",
    name: "Media",
    size: 26506628051,
    members: [
      {
        uid: "19-0",
        name: "Kyla Gowthrop",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "19-1",
        name: "Evan Reightley",
        image: "/images/avatar/avatar-12.jpg",
      },
    ],
    updated_at: "12/12/2023",
  },
  {
    folder_id: "20",
    name: "Movies",
    size: 84044008497,
    members: [
      {
        uid: "20-0",
        name: "Kiri Grayshan",
        image: undefined,
      },
      {
        uid: "20-1",
        name: "Krystal Jakubovics",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "20-2",
        name: "Silva Corry",
        image: "/images/avatar/avatar-9.jpg",
      },
    ],
    updated_at: "12/8/2023",
  },
  {
    folder_id: "21",
    name: "Designs",
    size: 72272348820,
    members: [
      {
        uid: "21-0",
        name: "Auroora Fergie",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "21-1",
        name: "Eb Maddie",
        image: undefined,
      },
      {
        uid: "21-2",
        name: "Isadora Mathon",
        image: undefined,
      },
      {
        uid: "21-3",
        name: "Dimitry Fogarty",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "21-4",
        name: "Jaquenette Raitie",
        image: "/images/avatar/avatar-6.jpg",
      },
    ],
    updated_at: "12/19/2023",
  },
  {
    folder_id: "22",
    name: "Web Applications",
    size: 60475331167,
    members: [
      {
        uid: "22-0",
        name: "Alfreda Muge",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "22-1",
        name: "Allan Caneo",
        image: "/images/avatar/avatar-9.jpg",
      },
      {
        uid: "22-2",
        name: "Mac Devanny",
        image: undefined,
      },
      {
        uid: "22-3",
        name: "Juliann Elvins",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "22-4",
        name: "Dunc Prew",
        image: "/images/avatar/avatar-7.jpg",
      },
    ],
    updated_at: "12/21/2023",
  },
  {
    folder_id: "23",
    name: "Movies",
    size: 35951090917,
    members: [
      {
        uid: "23-0",
        name: "Marena Prosser",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "23-1",
        name: "Svend Devereux",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "23-2",
        name: "Olivie Thunderchief",
        image: undefined,
      },
      {
        uid: "23-3",
        name: "Karia Getley",
        image: "/images/avatar/avatar-12.jpg",
      },
    ],
    updated_at: "12/4/2023",
  },
  {
    folder_id: "24",
    name: "Web Applications",
    size: 41800030351,
    members: [
      {
        uid: "24-0",
        name: "Lilli Houseman",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "24-1",
        name: "Ugo Parrish",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "24-2",
        name: "Sander Tolmie",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "24-3",
        name: "Beau Faldo",
        image: undefined,
      },
    ],
    updated_at: "11/6/2023",
  },
  {
    folder_id: "25",
    name: "Designs",
    size: 11033960690,
    members: [
      {
        uid: "25-0",
        name: "Corbin Hagart",
        image: "/images/avatar/avatar-5.jpg",
      },
    ],
    updated_at: "12/31/2023",
  },
  {
    folder_id: "26",
    name: "Designs",
    size: 52518122841,
    members: [
      {
        uid: "26-0",
        name: "Yoshi Fritschmann",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "26-1",
        name: "Benson Sleep",
        image: undefined,
      },
      {
        uid: "26-2",
        name: "Aguste Sailer",
        image: undefined,
      },
    ],
    updated_at: "1/3/2024",
  },
  {
    folder_id: "27",
    name: "Archives",
    size: 99826491150,
    members: [
      {
        uid: "27-0",
        name: "Susie Brason",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "27-1",
        name: "Link Aizikovich",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "27-2",
        name: "Ruprecht O'Dempsey",
        image: "/images/avatar/avatar-12.jpg",
      },
    ],
    updated_at: "12/2/2023",
  },
  {
    folder_id: "28",
    name: "Archives",
    size: 4204979410,
    members: [
      {
        uid: "28-0",
        name: "Merrill Washbrook",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "28-1",
        name: "Leah Fist",
        image: undefined,
      },
      {
        uid: "28-2",
        name: "Leon Jacketts",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "28-3",
        name: "Kali Ceschi",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "28-4",
        name: "Hartwell Lesslie",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "12/20/2023",
  },
  {
    folder_id: "29",
    name: "Backup",
    size: 86744782106,
    members: [
      {
        uid: "29-0",
        name: "Anastasia Glusby",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "29-1",
        name: "Eve Bearfoot",
        image: "/images/avatar/avatar-1.jpg",
      },
    ],
    updated_at: "11/3/2023",
  },
  {
    folder_id: "30",
    name: "Media",
    size: 23955902523,
    members: [
      {
        uid: "30-0",
        name: "Molly Hassard",
        image: undefined,
      },
      {
        uid: "30-1",
        name: "Reagen Fahy",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "30-2",
        name: "Lacee Jobbings",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "30-3",
        name: "Red Fenkel",
        image: "/images/avatar/avatar-11.jpg",
      },
    ],
    updated_at: "11/24/2023",
  },
  {
    folder_id: "31",
    name: "Documents",
    size: 84137923164,
    members: [
      {
        uid: "31-0",
        name: "Quill Izzard",
        image: undefined,
      },
      {
        uid: "31-1",
        name: "Ingeberg Kidgell",
        image: undefined,
      },
      {
        uid: "31-2",
        name: "Gardy Morston",
        image: undefined,
      },
      {
        uid: "31-3",
        name: "Meier Rickersey",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "31-4",
        name: "Amberly Chene",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "1/7/2024",
  },
  {
    folder_id: "32",
    name: "Documents",
    size: 28045171929,
    members: [
      {
        uid: "32-0",
        name: "Terrence Burgot",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "32-1",
        name: "Roselin Rudkin",
        image: undefined,
      },
      {
        uid: "32-2",
        name: "Bowie Noell",
        image: undefined,
      },
    ],
    updated_at: "11/8/2023",
  },
  {
    folder_id: "33",
    name: "Movies",
    size: 91467093411,
    members: [
      {
        uid: "33-0",
        name: "Conchita Derry",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "33-1",
        name: "Booth Bricklebank",
        image: undefined,
      },
      {
        uid: "33-2",
        name: "Murry MacConchie",
        image: undefined,
      },
    ],
    updated_at: "11/23/2023",
  },
  {
    folder_id: "34",
    name: "Movies",
    size: 89068645621,
    members: [
      {
        uid: "34-0",
        name: "Dewey Mattke",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "34-1",
        name: "Erika Agnew",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "34-2",
        name: "Danica Archdeckne",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "34-3",
        name: "Lola Maidlow",
        image: "/images/avatar/avatar-20.jpg",
      },
      {
        uid: "34-4",
        name: "Janos Lemon",
        image: "/images/avatar/avatar-18.jpg",
      },
    ],
    updated_at: "11/15/2023",
  },
  {
    folder_id: "35",
    name: "Backup",
    size: 44821964804,
    members: [
      {
        uid: "35-0",
        name: "Guillaume Hegg",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "35-1",
        name: "Linc Aberdein",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "35-2",
        name: "Celine Narey",
        image: undefined,
      },
      {
        uid: "35-3",
        name: "Madelaine Excell",
        image: undefined,
      },
    ],
    updated_at: "12/6/2023",
  },
  {
    folder_id: "36",
    name: "Movies",
    size: 91602012076,
    members: [
      {
        uid: "36-0",
        name: "Lucienne Verzey",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "36-1",
        name: "Gregoire Poltone",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "36-2",
        name: "Mariel Darrigone",
        image: undefined,
      },
      {
        uid: "36-3",
        name: "Leanor Pardon",
        image: undefined,
      },
    ],
    updated_at: "11/21/2023",
  },
  {
    folder_id: "37",
    name: "Media",
    size: 97878326560,
    members: [
      {
        uid: "37-0",
        name: "Dinny Borborough",
        image: undefined,
      },
      {
        uid: "37-1",
        name: "Sal Knibbs",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "37-2",
        name: "Bree Fleet",
        image: "/images/avatar/avatar-3.jpg",
      },
    ],
    updated_at: "12/1/2023",
  },
  {
    folder_id: "38",
    name: "Designs",
    size: 20218160190,
    members: [
      {
        uid: "38-0",
        name: "Tobin Bellingham",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "38-1",
        name: "Justen Clemmitt",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "1/4/2024",
  },
  {
    folder_id: "39",
    name: "Movies",
    size: 52680973246,
    members: [
      {
        uid: "39-0",
        name: "Alejandrina Killford",
        image: undefined,
      },
      {
        uid: "39-1",
        name: "Malinda Propper",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "12/6/2023",
  },
  {
    folder_id: "40",
    name: "Backup",
    size: 7143581697,
    members: [
      {
        uid: "40-0",
        name: "Justin Aisman",
        image: undefined,
      },
      {
        uid: "40-1",
        name: "Sue Hutchin",
        image: undefined,
      },
      {
        uid: "40-2",
        name: "Indira Di Ruggiero",
        image: undefined,
      },
      {
        uid: "40-3",
        name: "Raine Block",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "40-4",
        name: "Ashia Reilinger",
        image: undefined,
      },
    ],
    updated_at: "12/29/2023",
  },
  {
    folder_id: "41",
    name: "Web Applications",
    size: 36601927400,
    members: [
      {
        uid: "41-0",
        name: "Jilleen Mackiewicz",
        image: "/images/avatar/avatar-11.jpg",
      },
    ],
    updated_at: "11/4/2023",
  },
  {
    folder_id: "42",
    name: "Movies",
    size: 96090831368,
    members: [
      {
        uid: "42-0",
        name: "Brock Fawthorpe",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "42-1",
        name: "Dorian Niblo",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "12/1/2023",
  },
  {
    folder_id: "43",
    name: "Movies",
    size: 13679814741,
    members: [
      {
        uid: "43-0",
        name: "Kate Stears",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "11/1/2023",
  },
  {
    folder_id: "44",
    name: "Designs",
    size: 65505532390,
    members: [
      {
        uid: "44-0",
        name: "Smitty Pemberton",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "44-1",
        name: "Lynna Osburn",
        image: "/images/avatar/avatar-20.jpg",
      },
      {
        uid: "44-2",
        name: "Dolley Prestner",
        image: undefined,
      },
      {
        uid: "44-3",
        name: "Lynsey Garrity",
        image: "/images/avatar/avatar-5.jpg",
      },
    ],
    updated_at: "12/24/2023",
  },
  {
    folder_id: "45",
    name: "Designs",
    size: 42931910218,
    members: [
      {
        uid: "45-0",
        name: "Melvin Duck",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "45-1",
        name: "Tito Tabbernor",
        image: undefined,
      },
      {
        uid: "45-2",
        name: "Patten Mountlow",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "45-3",
        name: "Joni Schutte",
        image: undefined,
      },
    ],
    updated_at: "11/6/2023",
  },
  {
    folder_id: "46",
    name: "Documents",
    size: 2058195904,
    members: [
      {
        uid: "46-0",
        name: "Holden Pond-Jones",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "46-1",
        name: "Gearalt Sennett",
        image: "/images/avatar/avatar-5.jpg",
      },
    ],
    updated_at: "11/19/2023",
  },
  {
    folder_id: "47",
    name: "Media",
    size: 95544047973,
    members: [
      {
        uid: "47-0",
        name: "Tadd Marrington",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "47-1",
        name: "Trueman Brankley",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "47-2",
        name: "Catriona Bliss",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "47-3",
        name: "Merilee Wintle",
        image: "/images/avatar/avatar-9.jpg",
      },
      {
        uid: "47-4",
        name: "Natty Ratcliffe",
        image: undefined,
      },
    ],
    updated_at: "1/6/2024",
  },
  {
    folder_id: "48",
    name: "Media",
    size: 63040651987,
    members: [
      {
        uid: "48-0",
        name: "Garry Berceros",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "48-1",
        name: "Chadwick McMinn",
        image: "/images/avatar/avatar-20.jpg",
      },
      {
        uid: "48-2",
        name: "Irvin Duesberry",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "48-3",
        name: "Nissie Semken",
        image: "/images/avatar/avatar-13.jpg",
      },
    ],
    updated_at: "11/22/2023",
  },
  {
    folder_id: "49",
    name: "Web Applications",
    size: 75409303312,
    members: [
      {
        uid: "49-0",
        name: "Blinny Ygou",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "49-1",
        name: "Simone Fyldes",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "49-2",
        name: "Camella Borton",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "49-3",
        name: "Ives Cullotey",
        image: "/images/avatar/avatar-2.jpg",
      },
    ],
    updated_at: "12/6/2023",
  },
  {
    folder_id: "50",
    name: "Designs",
    size: 97367229483,
    members: [
      {
        uid: "50-0",
        name: "Tildy Gimson",
        image: "/images/avatar/avatar-19.jpg",
      },
    ],
    updated_at: "11/30/2023",
  },
  {
    folder_id: "51",
    name: "Web Applications",
    size: 49032435248,
    members: [
      {
        uid: "51-0",
        name: "Kira Dennerly",
        image: undefined,
      },
      {
        uid: "51-1",
        name: "Hedwig East",
        image: undefined,
      },
      {
        uid: "51-2",
        name: "Alexei Ivimey",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "51-3",
        name: "Giulio Shimwall",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "51-4",
        name: "Konrad Drust",
        image: "/images/avatar/avatar-4.jpg",
      },
    ],
    updated_at: "12/29/2023",
  },
  {
    folder_id: "52",
    name: "Movies",
    size: 89488019385,
    members: [
      {
        uid: "52-0",
        name: "Paulie Brisbane",
        image: "/images/avatar/avatar-9.jpg",
      },
      {
        uid: "52-1",
        name: "Joane Fallawe",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "52-2",
        name: "Mada Bartalucci",
        image: undefined,
      },
      {
        uid: "52-3",
        name: "Brandyn Bishell",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "52-4",
        name: "Lynne Livingston",
        image: "/images/avatar/avatar-18.jpg",
      },
    ],
    updated_at: "11/10/2023",
  },
  {
    folder_id: "53",
    name: "Movies",
    size: 42914576572,
    members: [
      {
        uid: "53-0",
        name: "Pippy Shulver",
        image: undefined,
      },
      {
        uid: "53-1",
        name: "Herminia Mattei",
        image: undefined,
      },
      {
        uid: "53-2",
        name: "Egan Tomaszczyk",
        image: undefined,
      },
      {
        uid: "53-3",
        name: "Vinnie Rochewell",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "53-4",
        name: "Justina Langcastle",
        image: "/images/avatar/avatar-13.jpg",
      },
    ],
    updated_at: "12/12/2023",
  },
  {
    folder_id: "54",
    name: "Archives",
    size: 6342242488,
    members: [
      {
        uid: "54-0",
        name: "Natal Honack",
        image: undefined,
      },
      {
        uid: "54-1",
        name: "Kitty Turn",
        image: "/images/avatar/avatar-4.jpg",
      },
    ],
    updated_at: "12/10/2023",
  },
  {
    folder_id: "55",
    name: "Designs",
    size: 74936283046,
    members: [
      {
        uid: "55-0",
        name: "Ede Slimings",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "55-1",
        name: "Malchy Baniard",
        image: "/images/avatar/avatar-17.jpg",
      },
    ],
    updated_at: "11/16/2023",
  },
  {
    folder_id: "56",
    name: "Designs",
    size: 35761500452,
    members: [
      {
        uid: "56-0",
        name: "Lind Glowacki",
        image: undefined,
      },
      {
        uid: "56-1",
        name: "Ivor McAuslan",
        image: undefined,
      },
      {
        uid: "56-2",
        name: "Mahala Kovalski",
        image: undefined,
      },
      {
        uid: "56-3",
        name: "Lacey Gronou",
        image: undefined,
      },
    ],
    updated_at: "12/15/2023",
  },
  {
    folder_id: "57",
    name: "Media",
    size: 80815574251,
    members: [
      {
        uid: "57-0",
        name: "Andee Clineck",
        image: undefined,
      },
    ],
    updated_at: "11/25/2023",
  },
  {
    folder_id: "58",
    name: "Media",
    size: 2674235727,
    members: [
      {
        uid: "58-0",
        name: "Lexie Robardet",
        image: "/images/avatar/avatar-6.jpg",
      },
    ],
    updated_at: "11/30/2023",
  },
  {
    folder_id: "59",
    name: "Movies",
    size: 66201186401,
    members: [
      {
        uid: "59-0",
        name: "Beth Ewbanck",
        image: undefined,
      },
      {
        uid: "59-1",
        name: "Tammy McCaffery",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "59-2",
        name: "Hedvige Cinderey",
        image: undefined,
      },
      {
        uid: "59-3",
        name: "Phebe Sango",
        image: undefined,
      },
    ],
    updated_at: "12/2/2023",
  },
  {
    folder_id: "60",
    name: "Designs",
    size: 19101696076,
    members: [
      {
        uid: "60-0",
        name: "Toma Cawsy",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "60-1",
        name: "Dorella Arnau",
        image: undefined,
      },
    ],
    updated_at: "12/16/2023",
  },
  {
    folder_id: "61",
    name: "Documents",
    size: 78889701121,
    members: [
      {
        uid: "61-0",
        name: "Dulcinea Brownill",
        image: "/images/avatar/avatar-4.jpg",
      },
      {
        uid: "61-1",
        name: "Krishna Demangeot",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "61-2",
        name: "Jere Booty",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "61-3",
        name: "Wiley Philpott",
        image: "/images/avatar/avatar-3.jpg",
      },
    ],
    updated_at: "1/2/2024",
  },
  {
    folder_id: "62",
    name: "Movies",
    size: 59213266530,
    members: [
      {
        uid: "62-0",
        name: "Pail Forrestor",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "62-1",
        name: "Bendite Osgardby",
        image: undefined,
      },
      {
        uid: "62-2",
        name: "Bayard Audley",
        image: "/images/avatar/avatar-5.jpg",
      },
    ],
    updated_at: "12/7/2023",
  },
  {
    folder_id: "63",
    name: "Media",
    size: 85930750535,
    members: [
      {
        uid: "63-0",
        name: "Alvira Taaffe",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "63-1",
        name: "Lesly Cavanagh",
        image: undefined,
      },
      {
        uid: "63-2",
        name: "Carrol Chilcotte",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "63-3",
        name: "Adamo Fenck",
        image: undefined,
      },
    ],
    updated_at: "12/20/2023",
  },
  {
    folder_id: "64",
    name: "Designs",
    size: 60290270618,
    members: [
      {
        uid: "64-0",
        name: "Gabi Gimlet",
        image: undefined,
      },
      {
        uid: "64-1",
        name: "Rainer Early",
        image: undefined,
      },
    ],
    updated_at: "12/27/2023",
  },
  {
    folder_id: "65",
    name: "Documents",
    size: 92070959282,
    members: [
      {
        uid: "65-0",
        name: "Anatollo Pinkett",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "65-1",
        name: "Anton Tann",
        image: undefined,
      },
      {
        uid: "65-2",
        name: "Kaitlin Gilbeart",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "65-3",
        name: "Bambie Lankester",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "65-4",
        name: "Jarad McTeer",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "11/5/2023",
  },
  {
    folder_id: "66",
    name: "Movies",
    size: 9679078821,
    members: [
      {
        uid: "66-0",
        name: "Appolonia Kondratenya",
        image: undefined,
      },
      {
        uid: "66-1",
        name: "Koenraad Bruneau",
        image: undefined,
      },
      {
        uid: "66-2",
        name: "Johnath Jerromes",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "66-3",
        name: "Kaspar O'Monahan",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "66-4",
        name: "Ignaz Assaf",
        image: undefined,
      },
    ],
    updated_at: "11/1/2023",
  },
  {
    folder_id: "67",
    name: "Media",
    size: 54879565299,
    members: [
      {
        uid: "67-0",
        name: "Phillis Lyard",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "67-1",
        name: "Morgun Vivian",
        image: undefined,
      },
      {
        uid: "67-2",
        name: "Arliene Sansun",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "67-3",
        name: "Barnebas Gummary",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "67-4",
        name: "Hermann Crooke",
        image: "/images/avatar/avatar-17.jpg",
      },
    ],
    updated_at: "1/4/2024",
  },
  {
    folder_id: "68",
    name: "Web Applications",
    size: 15411061175,
    members: [
      {
        uid: "68-0",
        name: "Magdalene Nana",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "68-1",
        name: "Jude Brazur",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "68-2",
        name: "Nilson Arnull",
        image: undefined,
      },
      {
        uid: "68-3",
        name: "Pippy Bracher",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "68-4",
        name: "Dolph Challender",
        image: "/images/avatar/avatar-19.jpg",
      },
    ],
    updated_at: "11/19/2023",
  },
  {
    folder_id: "69",
    name: "Web Applications",
    size: 35289906279,
    members: [
      {
        uid: "69-0",
        name: "Leta Beney",
        image: undefined,
      },
      {
        uid: "69-1",
        name: "Meredeth Troak",
        image: undefined,
      },
      {
        uid: "69-2",
        name: "Hans Braysher",
        image: "/images/avatar/avatar-4.jpg",
      },
    ],
    updated_at: "12/4/2023",
  },
  {
    folder_id: "70",
    name: "Documents",
    size: 24142788929,
    members: [
      {
        uid: "70-0",
        name: "Ashley Frew",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "70-1",
        name: "Garik Manclark",
        image: "/images/avatar/avatar-15.jpg",
      },
    ],
    updated_at: "12/24/2023",
  },
  {
    folder_id: "71",
    name: "Media",
    size: 21739100678,
    members: [
      {
        uid: "71-0",
        name: "Delila Zoane",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "71-1",
        name: "Alene Milazzo",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "71-2",
        name: "Sully Shacklady",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "71-3",
        name: "Terrill Simkovitz",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "71-4",
        name: "Sergent Daish",
        image: "/images/avatar/avatar-9.jpg",
      },
    ],
    updated_at: "12/16/2023",
  },
  {
    folder_id: "72",
    name: "Backup",
    size: 99888897500,
    members: [
      {
        uid: "72-0",
        name: "Fania Cumberland",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "72-1",
        name: "Heath Heninghem",
        image: undefined,
      },
    ],
    updated_at: "11/17/2023",
  },
  {
    folder_id: "73",
    name: "Documents",
    size: 58657376940,
    members: [
      {
        uid: "73-0",
        name: "Nichol Cannavan",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "73-1",
        name: "Tracie Girth",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "11/6/2023",
  },
  {
    folder_id: "74",
    name: "Web Applications",
    size: 79877964520,
    members: [
      {
        uid: "74-0",
        name: "Enrika Martin",
        image: "/images/avatar/avatar-19.jpg",
      },
    ],
    updated_at: "11/11/2023",
  },
  {
    folder_id: "75",
    name: "Backup",
    size: 34455283219,
    members: [
      {
        uid: "75-0",
        name: "Denis Pyper",
        image: undefined,
      },
      {
        uid: "75-1",
        name: "Garvin Mc Gaughey",
        image: "/images/avatar/avatar-19.jpg",
      },
    ],
    updated_at: "11/22/2023",
  },
  {
    folder_id: "76",
    name: "Documents",
    size: 29141950144,
    members: [
      {
        uid: "76-0",
        name: "Lind McRobbie",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "76-1",
        name: "Juli Ormonde",
        image: undefined,
      },
    ],
    updated_at: "11/6/2023",
  },
  {
    folder_id: "77",
    name: "Designs",
    size: 65720912573,
    members: [
      {
        uid: "77-0",
        name: "Cassandry Tongs",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "77-1",
        name: "Marmaduke Linny",
        image: "/images/avatar/avatar-13.jpg",
      },
      {
        uid: "77-2",
        name: "Lindy Donalson",
        image: undefined,
      },
    ],
    updated_at: "12/27/2023",
  },
  {
    folder_id: "78",
    name: "Movies",
    size: 57526977088,
    members: [
      {
        uid: "78-0",
        name: "Karena Fanti",
        image: "/images/avatar/avatar-6.jpg",
      },
      {
        uid: "78-1",
        name: "Loria Almeida",
        image: undefined,
      },
      {
        uid: "78-2",
        name: "Kaja Dozdill",
        image: "/images/avatar/avatar-12.jpg",
      },
    ],
    updated_at: "11/4/2023",
  },
  {
    folder_id: "79",
    name: "Designs",
    size: 56718950077,
    members: [
      {
        uid: "79-0",
        name: "Rowe Runcieman",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "79-1",
        name: "Stanleigh Fishley",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "79-2",
        name: "Stearne Calderhead",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "79-3",
        name: "Minta Godfray",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "79-4",
        name: "Odell Brandone",
        image: "/images/avatar/avatar-7.jpg",
      },
    ],
    updated_at: "11/15/2023",
  },
  {
    folder_id: "80",
    name: "Media",
    size: 983731441,
    members: [
      {
        uid: "80-0",
        name: "Cecilla Prescote",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "80-1",
        name: "Eldin Hodgin",
        image: undefined,
      },
      {
        uid: "80-2",
        name: "Cordi Ferrige",
        image: undefined,
      },
    ],
    updated_at: "1/4/2024",
  },
  {
    folder_id: "81",
    name: "Web Applications",
    size: 91197064814,
    members: [
      {
        uid: "81-0",
        name: "Rich Huggan",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "81-1",
        name: "Carny Allsop",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "81-2",
        name: "Liane Haycox",
        image: undefined,
      },
      {
        uid: "81-3",
        name: "Karol Mowsdell",
        image: "/images/avatar/avatar-4.jpg",
      },
    ],
    updated_at: "12/29/2023",
  },
  {
    folder_id: "82",
    name: "Media",
    size: 44850990416,
    members: [
      {
        uid: "82-0",
        name: "Zoe Elecum",
        image: undefined,
      },
      {
        uid: "82-1",
        name: "Alfie Langthorne",
        image: undefined,
      },
    ],
    updated_at: "11/6/2023",
  },
  {
    folder_id: "83",
    name: "Documents",
    size: 8533091973,
    members: [
      {
        uid: "83-0",
        name: "Ram Milsted",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "83-1",
        name: "Virgilio Villiers",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "83-2",
        name: "Blancha Duckels",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "83-3",
        name: "Blane Richel",
        image: "/images/avatar/avatar-3.jpg",
      },
      {
        uid: "83-4",
        name: "Sofie Jenton",
        image: "/images/avatar/avatar-7.jpg",
      },
    ],
    updated_at: "11/12/2023",
  },
  {
    folder_id: "84",
    name: "Movies",
    size: 98193756495,
    members: [
      {
        uid: "84-0",
        name: "Harriett Henricsson",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "84-1",
        name: "Broderick Whitfeld",
        image: undefined,
      },
    ],
    updated_at: "11/7/2023",
  },
  {
    folder_id: "85",
    name: "Designs",
    size: 439692855,
    members: [
      {
        uid: "85-0",
        name: "Field Beavors",
        image: "/images/avatar/avatar-1.jpg",
      },
      {
        uid: "85-1",
        name: "Sabra Cromleholme",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "85-2",
        name: "Jacobo Hulstrom",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "85-3",
        name: "Vally Kassel",
        image: "/images/avatar/avatar-8.jpg",
      },
      {
        uid: "85-4",
        name: "Beau Pring",
        image: undefined,
      },
    ],
    updated_at: "11/22/2023",
  },
  {
    folder_id: "86",
    name: "Movies",
    size: 59382836867,
    members: [
      {
        uid: "86-0",
        name: "Caril Mahody",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "86-1",
        name: "Annecorinne Jaycocks",
        image: "/images/avatar/avatar-12.jpg",
      },
      {
        uid: "86-2",
        name: "Mendie Ohanessian",
        image: undefined,
      },
    ],
    updated_at: "1/3/2024",
  },
  {
    folder_id: "87",
    name: "Documents",
    size: 95224458220,
    members: [
      {
        uid: "87-0",
        name: "Jacinta Carde",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "87-1",
        name: "Gusta Seilmann",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "87-2",
        name: "Kacey Pretsel",
        image: undefined,
      },
      {
        uid: "87-3",
        name: "Nance Connal",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "11/14/2023",
  },
  {
    folder_id: "88",
    name: "Documents",
    size: 29296991266,
    members: [
      {
        uid: "88-0",
        name: "Allix Archbould",
        image: undefined,
      },
      {
        uid: "88-1",
        name: "Alvinia Blowfield",
        image: "/images/avatar/avatar-2.jpg",
      },
      {
        uid: "88-2",
        name: "Quentin Fittes",
        image: "/images/avatar/avatar-6.jpg",
      },
    ],
    updated_at: "11/22/2023",
  },
  {
    folder_id: "89",
    name: "Designs",
    size: 30963976633,
    members: [
      {
        uid: "89-0",
        name: "Benn Btham",
        image: undefined,
      },
      {
        uid: "89-1",
        name: "Hamlen Sandall",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "89-2",
        name: "Rad Dorran",
        image: "/images/avatar/avatar-11.jpg",
      },
      {
        uid: "89-3",
        name: "Gardiner Malsher",
        image: undefined,
      },
    ],
    updated_at: "11/15/2023",
  },
  {
    folder_id: "90",
    name: "Web Applications",
    size: 9416003609,
    members: [
      {
        uid: "90-0",
        name: "Sallyann Arthur",
        image: undefined,
      },
      {
        uid: "90-1",
        name: "Cherish Devericks",
        image: "/images/avatar/avatar-10.jpg",
      },
    ],
    updated_at: "11/21/2023",
  },
  {
    folder_id: "91",
    name: "Movies",
    size: 1305762532,
    members: [
      {
        uid: "91-0",
        name: "Cinderella Sleney",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "91-1",
        name: "Debi Bowen",
        image: "/images/avatar/avatar-19.jpg",
      },
      {
        uid: "91-2",
        name: "Willie Pedrollo",
        image: undefined,
      },
      {
        uid: "91-3",
        name: "Parke Pendlebury",
        image: undefined,
      },
      {
        uid: "91-4",
        name: "Silvana Maffioni",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "12/20/2023",
  },
  {
    folder_id: "92",
    name: "Designs",
    size: 78627521730,
    members: [
      {
        uid: "92-0",
        name: "Leigh Forrington",
        image: undefined,
      },
      {
        uid: "92-1",
        name: "Paulie Massot",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "92-2",
        name: "Amaleta Snell",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "92-3",
        name: "Pieter Sturdey",
        image: undefined,
      },
      {
        uid: "92-4",
        name: "Gerek Stivers",
        image: "/images/avatar/avatar-17.jpg",
      },
    ],
    updated_at: "11/23/2023",
  },
  {
    folder_id: "93",
    name: "Designs",
    size: 55785227033,
    members: [
      {
        uid: "93-0",
        name: "Towney Wingate",
        image: undefined,
      },
      {
        uid: "93-1",
        name: "Nicol Christoffels",
        image: "/images/avatar/avatar-5.jpg",
      },
      {
        uid: "93-2",
        name: "Zaneta Colaton",
        image: "/images/avatar/avatar-7.jpg",
      },
      {
        uid: "93-3",
        name: "Jessika Rodder",
        image: undefined,
      },
    ],
    updated_at: "1/3/2024",
  },
  {
    folder_id: "94",
    name: "Media",
    size: 30112928332,
    members: [
      {
        uid: "94-0",
        name: "Wilma Blackbourn",
        image: "/images/avatar/avatar-8.jpg",
      },
    ],
    updated_at: "12/19/2023",
  },
  {
    folder_id: "95",
    name: "Movies",
    size: 63756171536,
    members: [
      {
        uid: "95-0",
        name: "Madlin Fogg",
        image: "/images/avatar/avatar-2.jpg",
      },
    ],
    updated_at: "12/2/2023",
  },
  {
    folder_id: "96",
    name: "Movies",
    size: 48757342400,
    members: [
      {
        uid: "96-0",
        name: "Cobby Joberne",
        image: "/images/avatar/avatar-16.jpg",
      },
      {
        uid: "96-1",
        name: "Mahmud Anespie",
        image: "/images/avatar/avatar-18.jpg",
      },
      {
        uid: "96-2",
        name: "Obed Petrovsky",
        image: "/images/avatar/avatar-6.jpg",
      },
    ],
    updated_at: "11/10/2023",
  },
  {
    folder_id: "97",
    name: "Documents",
    size: 88530432099,
    members: [
      {
        uid: "97-0",
        name: "Dorisa Brazenor",
        image: "/images/avatar/avatar-20.jpg",
      },
    ],
    updated_at: "12/1/2023",
  },
  {
    folder_id: "98",
    name: "Archives",
    size: 97670034383,
    members: [
      {
        uid: "98-0",
        name: "Vere Yusupov",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "98-1",
        name: "Lou O'Spillane",
        image: "/images/avatar/avatar-10.jpg",
      },
      {
        uid: "98-2",
        name: "Blair Jeune",
        image: undefined,
      },
      {
        uid: "98-3",
        name: "Gram Mickan",
        image: "/images/avatar/avatar-17.jpg",
      },
      {
        uid: "98-4",
        name: "Terrell Gusney",
        image: undefined,
      },
    ],
    updated_at: "12/23/2023",
  },
  {
    folder_id: "99",
    name: "Archives",
    size: 56682237168,
    members: [
      {
        uid: "99-0",
        name: "Lorrie Jenckes",
        image: "/images/avatar/avatar-18.jpg",
      },
    ],
    updated_at: "12/8/2023",
  },
  {
    folder_id: "100",
    name: "Designs",
    size: 45330531171,
    members: [
      {
        uid: "100-0",
        name: "Kathi Skirven",
        image: "/images/avatar/avatar-15.jpg",
      },
      {
        uid: "100-1",
        name: "Tamarra Desquesnes",
        image: undefined,
      },
      {
        uid: "100-2",
        name: "Cathi Oxford",
        image: "/images/avatar/avatar-14.jpg",
      },
      {
        uid: "100-3",
        name: "Rori Wandrich",
        image: undefined,
      },
    ],
    updated_at: "11/14/2023",
  },
];
