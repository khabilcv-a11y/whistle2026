/* Suggestion lists for the registration form (type-ahead only: applicants may always type something else).
 * An entry can carry alternative spellings: 'Main name|Other spelling|Another'. The first one is what gets filled in.
 * EDIT THESE LISTS to add or correct names, then rebuild (python3 tools/build_two_files.py <your /exec URL>). */
(function (w) {
  'use strict';
  function add(list, suffix) { return list.map(function (s) { return s.split('|').map(function (x) { return x + suffix; }).join('|'); }); }

  var KOZ_CORPORATION = ['Kozhikode Corporation|Calicut Corporation|Kozhikode Municipal Corporation'];
  var KOZ_MUNICIPALITIES = ['Koyilandy|Quilandy', 'Vadakara|Badagara', 'Payyoli', 'Ramanattukara', 'Koduvally', 'Mukkam', 'Feroke'];
  var KOZ_PANCHAYATS = ['Arikkulam', 'Atholi', 'Ayancheri', 'Azhiyur|Azhiyoor', 'Balussery', 'Chakkittapara|Chakkittappara', 'Changaroth', 'Chathamangalam',
    'Chekkiad|Chekkiyad', 'Chemancheri', 'Chengottukavu', 'Cheruvannur', 'Chorode', 'Edacheri|Edachery', 'Eramala', 'Kakkodi', 'Kakkur|Kakkoor', 'Karassery',
    'Kattippara', 'Kavilumpara', 'Kayakkodi', 'Kayanna', 'Keezhariyur', 'Kizhakkoth', 'Kodencheri|Kodenchery|Kodanchery', 'Kodiyathur', 'Koodaranji|Koodaranhi',
    'Koorachundu', 'Kottur', 'Kunnamangalam', 'Kunnummal', 'Kuruvattur|Kuruvattoor', 'Kuttiady', 'Madavoor', 'Maniyur', 'Mavoor', 'Meppayur', 'Moodadi',
    'Nadapuram', 'Naduvannur', 'Nanminda|Nanmanda', 'Narikkuni', 'Narippatta', 'Nochad', 'Olavanna', 'Omassery|Omasseri', 'Orkkatteri', 'Panangad',
    'Perambra', 'Peruvayal', 'Perumanna', 'Puduppadi|Puthuppadi', 'Purameri', 'Thalakkulathur', 'Thamarassery', 'Thikkodi', 'Thiruvallur',
    'Thiruvambady|Thiruvambadi', 'Thuneri', 'Ulliyeri', 'Unnikulam', 'Valayam', 'Vanimel', 'Velom', 'Villiappally|Vilyapally'];

  var COLLEGES = [
    // Kerala universities and institutions
    'University of Calicut', 'University of Kerala', 'Mahatma Gandhi University, Kottayam', 'Kannur University', 'Cochin University of Science and Technology (CUSAT)',
    'Kerala Agricultural University', 'APJ Abdul Kalam Technological University', 'Sree Sankaracharya University of Sanskrit, Kalady', 'Central University of Kerala, Kasaragod',
    'National Institute of Technology (NIT) Calicut', 'Government Engineering College, Kozhikode', 'Government Law College, Kozhikode', 'Kerala Law Academy Law College, Thiruvananthapuram',
    // Kozhikode and Malabar
    'St. Joseph\'s College, Devagiri, Kozhikode', 'Providence Women\'s College, Kozhikode', 'Malabar Christian College, Kozhikode', 'Zamorin\'s Guruvayurappan College, Kozhikode',
    'Farook College, Kozhikode', 'Government Arts and Science College, Meenchanda, Kozhikode', 'Government College, Madappally', 'Government Arts and Science College, Kodanchery',
    'Government Arts and Science College, Koduvally', 'Sree Narayana Guru College, Chelannur', 'Kerala Government Arts and Science College, Kozhikode', 'PSMO College, Tirurangadi',
    'MES Mampad College', 'MES Kalladi College, Mannarkkad', 'MES Ponnani College', 'Government College, Malappuram', 'Government Arts and Science College, Malappuram', 'Unity Women\'s College, Manjeri',
    'Sir Syed College, Taliparamba', 'Payyanur College', 'Kannur University - Payyanur College', 'Government Brennen College, Thalassery', 'Government College, Kasaragod',
    'Nehru Arts and Science College, Kanhangad', 'St. Pius X College, Rajapuram', 'Mary Matha Arts and Science College, Mananthavady', 'Government College, Mananthavady', 'Pazhassi Raja College, Pulpally',
    'Mercy College, Palakkad', 'Government Victoria College, Palakkad', 'NSS College, Ottapalam', 'Government College, Chittur', 'Rajiv Gandhi Memorial Government Arts and Science College, Attappadi, Palakkad',
    // Central and south Kerala
    'Sree Kerala Varma College, Thrissur', 'St. Thomas College, Thrissur', 'Vimala College, Thrissur', 'Little Flower College, Guruvayoor', 'Government College, Chalakudy', 'Christ College, Irinjalakuda',
    'Maharaja\'s College, Ernakulam', 'St. Teresa\'s College, Ernakulam', 'St. Albert\'s College, Ernakulam', 'Sacred Heart College, Thevara', 'Rajagiri College of Social Sciences, Kalamassery',
    'Union Christian College, Aluva', 'Bharata Mata College, Thrikkakara', 'Government Arts and Science College, Karyavattom, Thiruvananthapuram', 'Little Flower Institute of Social Sciences and Health, Kalamassery',
    'University College, Thiruvananthapuram', 'Government Arts College, Thiruvananthapuram', 'Mar Ivanios College, Thiruvananthapuram', 'Government College for Women, Thiruvananthapuram',
    'All Saints\' College, Thiruvananthapuram', 'Government College, Kariavattom', 'CMS College, Kottayam', 'Baselius College, Kottayam', 'Assumption College, Changanacherry', 'S.B. College, Changanacherry',
    'Newman College, Thodupuzha', 'St. Thomas College, Pala', 'Alphonsa College, Pala', 'Fatima Mata National College, Kollam', 'Sree Narayana College, Kollam', 'Catholicate College, Pathanamthitta',
    // Delhi University and other national institutions
    'University of Delhi', 'Hindu College, University of Delhi', 'St. Stephen\'s College, University of Delhi', 'Miranda House, University of Delhi', 'Lady Shri Ram College for Women, University of Delhi',
    'Hansraj College, University of Delhi', 'Kirori Mal College, University of Delhi', 'Ramjas College, University of Delhi', 'Sri Venkateswara College, University of Delhi', 'Daulat Ram College, University of Delhi',
    'Gargi College, University of Delhi', 'Jesus and Mary College, University of Delhi', 'Indraprastha College for Women, University of Delhi', 'Kamala Nehru College, University of Delhi',
    'Zakir Husain Delhi College, University of Delhi', 'Deen Dayal Upadhyaya College, University of Delhi', 'Sri Aurobindo College, University of Delhi', 'Motilal Nehru College, University of Delhi',
    'Maitreyi College, University of Delhi', 'Ramanujan College, University of Delhi', 'Dyal Singh College, University of Delhi', 'Rajdhani College, University of Delhi', 'Shivaji College, University of Delhi',
    'Aryabhatta College, University of Delhi', 'Atma Ram Sanatan Dharma College, University of Delhi', 'Shaheed Bhagat Singh College, University of Delhi', 'Janki Devi Memorial College, University of Delhi',
    'Sri Guru Gobind Singh College of Commerce, University of Delhi', 'Sri Guru Tegh Bahadur Khalsa College, University of Delhi', 'Delhi College of Arts and Commerce, University of Delhi',
    'Jawaharlal Nehru University', 'Jamia Millia Islamia, New Delhi', 'Ambedkar University Delhi', 'Aligarh Muslim University', 'Banaras Hindu University', 'University of Hyderabad', 'Pondicherry University',
    'Tata Institute of Social Sciences', 'Azim Premji University', 'Ashoka University', 'FLAME University', 'Symbiosis International University', 'Fergusson College, Pune', 'St. Xavier\'s College, Mumbai',
    'St. Xavier\'s College, Kolkata', 'Presidency University, Kolkata', 'Jadavpur University', 'Christ (Deemed to be University), Bengaluru', 'Kristu Jayanti College (Autonomous), Bengaluru',
    'St. Joseph\'s College (Autonomous), Bengaluru', 'Mount Carmel College, Bengaluru', 'Jain (Deemed-to-be University), Bengaluru', 'Bangalore University', 'Mangalore University',
    'Loyola College, Chennai', 'Madras Christian College, Chennai', 'Presidency College, Chennai', 'Stella Maris College, Chennai', 'Women\'s Christian College, Chennai', 'PSG College of Arts and Science, Coimbatore',
    'Amrita Vishwa Vidyapeetham', 'Manipal Academy of Higher Education', 'Sir Syed College, Taliparamba'
  ];

  w.DCIP_LISTS = {
    kozhikodeLocalBodies: KOZ_CORPORATION.concat(add(KOZ_MUNICIPALITIES, ' Municipality'), add(KOZ_PANCHAYATS, ' Grama Panchayat')),
    colleges: COLLEGES
  };
})(window);
