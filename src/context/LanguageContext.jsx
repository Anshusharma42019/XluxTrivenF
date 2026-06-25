import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

const translations = {
  en: {
    // Sidebar / Navigation
    'Dashboard': 'Dashboard',
    'Leads': 'Leads',
    'Action Required': 'Action Required',
    'CNP': 'CNP',
    'Tasks': 'Tasks',
    'Follow Up': 'Follow Up',
    'Verification': 'Verification',
    'Ready to Ship': 'Ready to Ship',
    'Shiprocket': 'Shiprocket',
    'NDR': 'NDR',
    'Team': 'Team',
    'Appointments': 'Appointments',
    'Attendance': 'Attendance',
    'Re-Order Commission': 'Re-Order Commission',
    'Staff': 'Staff',
    'System Online': 'System Online',
    'System Offline': 'System Offline',

    // Dashboard & Stats
    'ORDER STATUS': 'ORDER STATUS',
    'ORDERS TOTAL': 'ORDERS TOTAL',
    'DELIVERED': 'DELIVERED',
    'RTO DELIVERED': 'RTO DELIVERED',
    'IN TRANSIT': 'IN TRANSIT',
    'CANCELED': 'CANCELED',
    'NEW': 'NEW',
    'RTO IN TRANSIT': 'RTO IN TRANSIT',
    'OUT FOR DELIVERY': 'OUT FOR DELIVERY',
    'REACHED BACK AT SELLER CITY': 'REACHED BACK AT SELLER CITY',
    'UNDELIVERED 1ST ATTEMPT': 'UNDELIVERED 1ST ATTEMPT',
    'PICKUP EXCEPTION': 'PICKUP EXCEPTION',
    'UNDELIVERED 2ND ATTEMPT': 'UNDELIVERED 2ND ATTEMPT',
    'UNDELIVERED 3RD ATTEMPT': 'UNDELIVERED 3RD ATTEMPT',
    'UNDELIVERED': 'UNDELIVERED',
    'UNDELIVERED ATTEMPT FAILURE': 'UNDELIVERED ATTEMPT FAILURE',
    'RTO INITIATED': 'RTO INITIATED',
    'REACHED AT DESTINATION HUB': 'REACHED AT DESTINATION HUB',
    'SHIPPED': 'SHIPPED',
    'RTO OFD': 'RTO OFD',
    'PICKUP SCHEDULED': 'PICKUP SCHEDULED',
    'MISROUTED': 'MISROUTED',
    'INVOICED': 'INVOICED',

    // Layout / Header / Menu
    'Search lead or order...': 'Search lead or order...',
    'My Profile': 'My Profile',
    'Change Password': 'Change Password',
    'Logout': 'Logout',
    'THEME': 'THEME',
    'LANGUAGE': 'LANGUAGE',
    'LIGHT': 'LIGHT',
    'DARK': 'DARK',
    'SHIFT TIMER': 'SHIFT TIMER',
    'TODAY COMMISSION': 'TODAY COMMISSION',
    'CHECK OUT': 'CHECK OUT',
    'CHECK IN': 'CHECK IN',
    'ACTIVE': 'ACTIVE',
    'COMPLETED': 'COMPLETED',
    'ACTIVE SHIFT': 'ACTIVE SHIFT',
    'OFFLINE': 'OFFLINE',
    'ONLINE': 'ONLINE',
    'Sign out': 'Sign out',
    'Clock In': 'Clock In',
    'Clock Out': 'Clock Out',

    // Dashboard Cards & Options
    'Dashboard Overview': 'Dashboard Overview',
    'Filtering for': 'Filtering for',
    'Total Leads': 'Total Leads',
    'Total Leads (Today)': 'Total Leads (Today)',
    'New Leads Today': 'New Leads Today',
    'New Leads (Today)': 'New Leads (Today)',
    'New Leads (Total)': 'New Leads (Total)',
    'Ready to Shipment': 'Ready to Shipment',
    'Revenue': 'Revenue',
    'New Order Delivered': 'New Order Delivered',
    'Old Order Delivered': 'Old Order Delivered',
    'Personal Attendance': 'Personal Attendance',
    'Not checked in yet': 'Not checked in yet',
    'Day Complete': 'Day Complete',
    'Click to download CSV': 'Click to download CSV',
    'Downloading...': 'Downloading...',
    'Leads CSV': 'Leads CSV',
    'All Depts': 'All Depts',
    'APPLY': 'APPLY',
    'Today': 'Today',
    'Yesterday': 'Yesterday',
    'Last 7 Days': 'Last 7 Days',
    'This Month': 'This Month',
    'All Time': 'All Time',
    'Custom': 'Custom',
    'Week': 'Week',
    'Month': 'Month',
    'Search name, phone...': 'Search name, phone...',
    'All Departments': 'All Departments',
    'ADD NEW LEAD': 'ADD NEW LEAD',
    'No leads found': 'No leads found',
  },
  hi_disabled: {
    // Sidebar / Navigation
    'Dashboard': 'डैशबोर्ड',
    'Leads': 'लीड्स',
    'Action Required': 'कार्रवाई आवश्यक',
    'CNP': 'सीएनपी (CNP)',
    'Tasks': 'कार्य / टास्क',
    'Follow Up': 'फ़ॉलो अप',
    'Verification': 'सत्यापन (Verification)',
    'Ready to Ship': 'भेजने के लिए तैयार',
    'Shiprocket': 'शिपरॉकेट',
    'NDR': 'एनडीआर (NDR)',
    'Team': 'टीम',
    'Appointments': 'अपॉइंटमेंट्स',
    'Attendance': 'हाजिरी (Attendance)',
    'Re-Order Commission': 'री-ऑर्डर कमीशन',
    'Staff': 'कर्मचारी (Staff)',
    'System Online': 'सिस्टम ऑनलाइन है',
    'System Offline': 'सिस्टम ऑफ़लाइन है',

    // Dashboard & Stats
    'ORDER STATUS': 'ऑर्डर की स्थिति',
    'ORDERS TOTAL': 'कुल ऑर्डर्स',
    'DELIVERED': 'डिलीवर हुआ',
    'RTO DELIVERED': 'RTO डिलीवर हुआ',
    'IN TRANSIT': 'मार्ग में (Transit)',
    'CANCELED': 'रद्द किया गया',
    'NEW': 'नया ऑर्डर',
    'RTO IN TRANSIT': 'RTO मार्ग में',
    'OUT FOR DELIVERY': 'वितरण के लिए बाहर',
    'REACHED BACK AT SELLER CITY': 'विक्रेता शहर वापस पहुंचा',
    'UNDELIVERED 1ST ATTEMPT': 'अवितरित पहला प्रयास',
    'PICKUP EXCEPTION': 'पिकअप अपवाद',
    'UNDELIVERED 2ND ATTEMPT': 'अवितरित दूसरा प्रयास',
    'UNDELIVERED 3RD ATTEMPT': 'अवितरित तीसरा प्रयास',
    'UNDELIVERED': 'अवितरित (Undelivered)',
    'UNDELIVERED ATTEMPT FAILURE': 'अवितरित प्रयास विफल',
    'RTO INITIATED': 'RTO शुरू हुआ',
    'REACHED AT DESTINATION HUB': 'गंतव्य हब पर पहुंचा',
    'SHIPPED': 'भेज दिया गया (Shipped)',
    'RTO OFD': 'RTO वितरण के लिए बाहर',
    'PICKUP SCHEDULED': 'पिकअप निर्धारित',
    'MISROUTED': 'गलत मार्ग',
    'INVOICED': 'इनवॉइस किया गया',

    // Layout / Header / Menu
    'Search lead or order...': 'लीड या ऑर्डर खोजें...',
    'My Profile': 'मेरी प्रोफ़ाइल',
    'Change Password': 'पासवर्ड बदलें',
    'Logout': 'लॉगआउट',
    'THEME': 'थीम',
    'LANGUAGE': 'भाषा बदलें',
    'LIGHT': 'लाइट',
    'DARK': 'डार्क',
    'SHIFT TIMER': 'शिफ्ट टाइमर',
    'TODAY COMMISSION': 'आज का कमीशन',
    'CHECK OUT': 'चेक आउट',
    'CHECK IN': 'चेक इन',
    'ACTIVE': 'सक्रिय',
    'COMPLETED': 'पूर्ण',
    'ACTIVE SHIFT': 'सक्रिय शिफ्ट',
    'OFFLINE': 'ऑफलाइन',
    'ONLINE': 'ऑनलाइन',
    'Sign out': 'लॉग आउट',
    'Clock In': 'चेक इन (Clock In)',
    'Clock Out': 'चेक आउट (Clock Out)',

    // Dashboard Cards & Options
    'Dashboard Overview': 'डैशबोर्ड अवलोकन',
    'Filtering for': 'फिल्टर की अवधि',
    'Total Leads': 'कुल लीड्स',
    'Total Leads (Today)': 'कुल लीड्स (आज)',
    'New Leads Today': 'नई लीड्स (आज)',
    'New Leads (Today)': 'नई लीड्स (आज)',
    'New Leads (Total)': 'नई लीड्स (कुल)',
    'Ready to Shipment': 'शिपमेंट के लिए तैयार',
    'Revenue': 'कुल राजस्व (Revenue)',
    'Personal Attendance': 'व्यक्तिगत उपस्थिति',
    'Not checked in yet': 'अभी चेक-इन नहीं किया है',
    'Day Complete': 'आज का कार्य पूर्ण',
    'Click to download CSV': 'CSV डाउनलोड करने के लिए क्लिक करें',
    'Downloading...': 'डाउनलोड हो रहा है...',
    'Leads CSV': 'लीड्स CSV',
    'All Depts': 'सभी विभाग',
    'APPLY': 'लागू करें',
    'Today': 'आज',
    'Yesterday': 'कल',
    'Last 7 Days': 'पिछले 7 दिन',
    'This Month': 'इस महीने',
    'All Time': 'कुल समय',
    'Custom': 'कस्टम',
    'Week': 'सप्ताह',
    'Month': 'महीना',
    'Search name, phone...': 'नाम, फोन खोजें...',
    'All Departments': 'सभी विभाग',
    'ADD NEW LEAD': 'नई लीड जोड़ें',
    'No leads found': 'कोई लीड नहीं मिली',
  }
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState('en');

  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('lang', newLang);
  };

  const t = (key, fallback) => {
    const cleanKey = String(key || '').trim();
    if (translations[lang] && translations[lang][cleanKey]) {
      return translations[lang][cleanKey];
    }
    // Also try case-insensitive and slash-replacement checks
    const upperKey = cleanKey.toUpperCase().replace(/[-_\s]+/g, ' ');
    const foundKey = Object.keys(translations[lang] || {}).find(
      k => k.toUpperCase().replace(/[-_\s]+/g, ' ') === upperKey
    );
    if (foundKey) {
      return translations[lang][foundKey];
    }
    return fallback !== undefined ? fallback : key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
