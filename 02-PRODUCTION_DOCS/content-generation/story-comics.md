How to Use                                                                                                        
                                                                                                                    
  Force next story theme:                                                                                           
  // story-themes.json                                                                                              
  "next": {                                                                                                         
    "theme": "Cherry Blossom Viewing",                                                                              
    "jlptLevel": "N4"                                                                                               
  }                                                                                                                 
                                                                                                                    
  Force next comic episode:                                                                                         
  // comic-themes.json                                                                                              
  "next": {                                                                                                         
    "theme": "beach",                                                                                               
    "location": "Okinawa Beach",                                                                                    
    "titleEn": "Beach Adventure",                                                                                   
    "titleJa": "ビーチの冒険",                                                                                      
    "jlptLevel": "N5",                                                                                              
    "characters": ["moshi-master", "yuki-sloth"]                                                                    
  }                              


  After generation, set values back to null to resume random selection.  


Automation Switches (Admin Feature Flags)

- `STORY_AUTOMATION`: Pauses/resumes scheduled story automation.
- `NEWS_AUTOMATION`: Pauses/resumes scheduled news scraping and scheduled news audio generation.
- `COMICS_AUTOMATION`: Pauses/resumes scheduled comic automation.

Where to change:

- Admin Dashboard: `/admin/feature-flags`
- Firestore: `config/featureFlags`

Note:

- These switches affect scheduled jobs only.
- Manual admin generation flows remain available.
