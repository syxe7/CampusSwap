(() => {
  const { api, toast, getUser } = window.CampusSwap;

  let listings = [];
  let category = "All";
  let oraCategoryFilter = null;
  let oraIntentLabel = "";
  let oraMaxPrice = null;
  let oraSearchTerm = "";

  const categories = [
    "All",
    "Books",
    "Lab Equipment",
    "Tech",
    "Home",
    "Fashion",
    "Sports",
    "Other",
  ];

  let saved = JSON.parse(localStorage.getItem("campusswap-saved") || "[]");

  const searchInput = document.querySelector("#search");
  const conditionSelect = document.querySelector("#condition");
  const sortSelect = document.querySelector("#sort");

  // Ora elements
  const oraWrapper = document.querySelector("#oraWrapper");
  const oraBubble = document.querySelector("#oraBubble");
  const oraMascot = document.querySelector("#oraMascot");
  const oraClose = document.querySelector("#oraClose");
  const oraName = document.querySelector("#oraName");
  const oraPrompt = document.querySelector("#oraPrompt");
  const oraActionButtons = document.querySelectorAll("[data-ora-action]");
  const oraMicButton = document.querySelector("#oraMicButton");
  const oraVoiceStatus = document.querySelector("#oraVoiceStatus");

  // ---------------------------------------------------------
  // ORA - SETUP
  // ---------------------------------------------------------
  function setupOra() {
    const user = getUser();
    const fullName = user?.name || "Student";
    const firstName = fullName.trim().split(/\s+/)[0] || "Student";

    oraName.textContent = firstName;

    // If Ora already greeted the student during this browser session,
    // keep only the small mascot visible.
    const alreadyGreeted =
      sessionStorage.getItem("campusswap-ora-greeted") === "true";

    if (alreadyGreeted) {
      minimiseOra();
    } else {
      sessionStorage.setItem("campusswap-ora-greeted", "true");
    }
  }

  function minimiseOra() {
    oraBubble.classList.add("hidden");
    oraWrapper.classList.add("minimised");
    oraMascot.setAttribute("aria-label", "Open Ora assistant");
  }

  function openOra() {
    oraBubble.classList.remove("hidden");
    oraWrapper.classList.remove("minimised");
    oraMascot.setAttribute("aria-label", "Ora assistant is open");
  }

  function setOraMessage(message) {
    oraPrompt.textContent = message;
  }

  function reactOra(reaction = "excited") {
    const reactionClasses = [
      "ora-excited",
      "ora-thinking",
      "ora-surprised",
    ];

    oraWrapper.classList.remove(...reactionClasses);
    oraWrapper.classList.add(`ora-${reaction}`);

    window.setTimeout(() => {
      oraWrapper.classList.remove(`ora-${reaction}`);
    }, 1200);
  }

  function resetMarketplaceFilters() {
    searchInput.value = "";
    conditionSelect.value = "Any condition";
    sortSelect.value = "Newest";
    category = "All";
    oraCategoryFilter = null;
    oraIntentLabel = "";
    oraMaxPrice = null;
    oraSearchTerm = "";
  }

  function clearOraIntent() {
    oraCategoryFilter = null;
    oraIntentLabel = "";
    oraMaxPrice = null;
    oraSearchTerm = "";
  }

  // ---------------------------------------------------------
  // ORA - SMART TEXT + VOICE SEARCH
  // ---------------------------------------------------------
  const oraCategoryKeywords = {
    Books: ["book", "books", "textbook", "textbooks", "novel", "notes", "reference"],
    "Lab Equipment": ["lab", "laboratory", "goggle", "goggles", "coat", "beaker", "equipment"],
    Tech: ["tech", "technology", "calculator", "laptop", "keyboard", "mouse", "charger", "cable", "headphone", "earphone", "tablet"],
    Home: ["home", "room", "hostel", "dorm", "lamp", "fan", "pillow", "storage", "hanger", "kettle", "mug"],
    Fashion: ["fashion", "clothes", "shirt", "hoodie", "jacket", "pants", "jeans", "shoe", "shoes", "bag"],
    Sports: ["sport", "sports", "badminton", "racket", "ball", "jersey", "gym"],
  };

  const oraFillerWords = new Set([
    "ora","please","pls","can","could","you","help","me","find","show","give","get",
    "want","need","looking","for","some","something","anything","a","an","the","my",
    "with","that","is","are","available","only","cheapest","cheap","budget","affordable",
    "newest","latest","recent","under","below","less","than","max","maximum","within",
    "around","about","rm","ringgit","stuff","item","items"
  ]);

  function convertSimpleNumberWords(value) {
    const units = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
      eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
    const tens = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
    const words = String(value || "").toLowerCase().split(/\s+/);
    const out = [];
    for (let i=0;i<words.length;i+=1) {
      const w=words[i], n=words[i+1];
      if (Object.prototype.hasOwnProperty.call(tens,w)) {
        if (Object.prototype.hasOwnProperty.call(units,n) && units[n] < 10) { out.push(String(tens[w]+units[n])); i+=1; }
        else out.push(String(tens[w]));
      } else if (Object.prototype.hasOwnProperty.call(units,w)) out.push(String(units[w]));
      else out.push(w);
    }
    return out.join(" ");
  }

  function normaliseOraText(value) {
    return convertSimpleNumberWords(value).toLowerCase().replace(/[’']/g,"")
      .replace(/[^a-z0-9.\s]/g," ").replace(/\s+/g," ").trim();
  }

  function extractOraBudget(text) {
    const patterns = [
      /(?:under|below|less than|max(?:imum)?|within)\s*(?:rm\s*)?(\d+(?:\.\d{1,2})?)/i,
      /(?:rm\s*)(\d+(?:\.\d{1,2})?)\s*(?:or less|and below|budget)?/i,
      /(?:budget(?: of)?|around|about)\s*(?:rm\s*)?(\d+(?:\.\d{1,2})?)/i,
      /(\d+(?:\.\d{1,2})?)\s*ringgit/i
    ];
    for (const p of patterns) { const m=text.match(p); if (m) return Number(m[1]); }
    return null;
  }

  function inferOraCategories(text) {
    const matches=[];
    Object.entries(oraCategoryKeywords).forEach(([cat,keys])=>{
      if (keys.some(k=>text.includes(k))) matches.push(cat);
    });
    if (/\b(class|study|studying|course|subject|lecture)\b/.test(text))
      ["Books","Lab Equipment","Tech"].forEach(x=>{if(!matches.includes(x))matches.push(x);});
    if (/\b(room|hostel|dorm|dormitory)\b/.test(text) && !matches.includes("Home")) matches.push("Home");
    return matches;
  }

  function extractOraSearchTerm(text) {
    const allKeywords = Object.values(oraCategoryKeywords).flat();
    return normaliseOraText(text.replace(/\b(?:rm\s*)?\d+(?:\.\d{1,2})?\b/gi," "))
      .split(" ").filter(Boolean).filter(w=>!oraFillerWords.has(w)).filter(w=>!allKeywords.includes(w)).join(" ").trim();
  }

  function parseOraRequest(raw) {
    const text=normaliseOraText(raw);
    const cheapest=/\b(cheapest|cheap|budget|affordable|lowest price)\b/.test(text);
    const newest=/\b(newest|latest|recent|fresh)\b/.test(text);
    return { rawRequest:raw, text, maxPrice:extractOraBudget(text), categories:inferOraCategories(text),
      searchTerm:extractOraSearchTerm(text), sort:cheapest?"Price: low to high":newest?"Newest":"Newest",
      wantsCheapest:cheapest, wantsNewest:newest };
  }

  function getFilteredListings() {
    const manual=searchInput.value.trim().toLowerCase(), condition=conditionSelect.value, sort=sortSelect.value;
    const assistant=oraSearchTerm.toLowerCase();
    let filtered=listings.filter(item=>{
      const hay=[item.title,item.description,item.category,item.condition].filter(Boolean).join(" ").toLowerCase();
      const cat=oraCategoryFilter?oraCategoryFilter.includes(item.category):(category==="All"||item.category===category);
      const cond=condition==="Any condition"||item.condition===condition;
      const manualOk=!manual||hay.includes(manual);
      const words=assistant.split(/\s+/).filter(Boolean);
      const assistantOk=!words.length||words.every(w=>hay.includes(w));
      const budgetOk=oraMaxPrice===null||Number(item.price)<=oraMaxPrice;
      return item.status==="Available"&&cat&&cond&&manualOk&&assistantOk&&budgetOk;
    });
    if(sort==="Price: low to high") filtered.sort((a,b)=>a.price-b.price);
    if(sort==="Price: high to low") filtered.sort((a,b)=>b.price-a.price);
    return filtered;
  }

  function describeOraResults(filtered,intent) {
    if(!filtered.length) return `Hmm, I couldn't find that right now 🥹 Try another keyword or a wider budget?`;
    const first=filtered[0], count=filtered.length;
    if(intent.wantsCheapest && intent.searchTerm)
      return `Gotchu 👀 The cheapest match I found is “${first.title}” at RM${Number(first.price).toFixed(2)}.`;
    if(intent.maxPrice!==null) return `Budget understood 💸 I found ${count} ${count===1?"match":"matches"} within RM${intent.maxPrice.toFixed(2)}.`;
    if(intent.wantsNewest) return `Fresh finds coming up ✨ I found ${count} ${count===1?"match":"matches"} for you.`;
    return `Found ${count} ${count===1?"match":"matches"} for you 🌱`;
  }

  function setOraVoiceStatus(message) { if(oraVoiceStatus) oraVoiceStatus.textContent=message; }

  function handleOraSearch(raw) {
    const request=raw.trim();
    if(!request){ setOraMessage("Tap the mic and tell me what you're hunting for 👀"); reactOra("thinking"); return; }
    openOra(); reactOra("thinking"); setOraVoiceStatus(`Searching for: “${request}”`);
    const intent=parseOraRequest(request);
    resetMarketplaceFilters();
    oraCategoryFilter=intent.categories.length?intent.categories:null;
    oraMaxPrice=intent.maxPrice; oraSearchTerm=intent.searchTerm; sortSelect.value=intent.sort;
    const labels=[];
    if(intent.searchTerm) labels.push(intent.searchTerm);
    else if(intent.categories.length===1) labels.push(intent.categories[0]);
    else if(intent.categories.length>1) labels.push("Class finds");
    if(intent.maxPrice!==null) labels.push(`≤ RM${intent.maxPrice.toFixed(0)}`);
    if(intent.wantsCheapest) labels.push("cheapest");
    else if(intent.wantsNewest) labels.push("newest");
    oraIntentLabel=`🌱 Ora: ${labels.join(" · ")||"Smart search"}`;
    render();
    const filtered=getFilteredListings();
    setOraMessage(describeOraResults(filtered,intent));
    reactOra(filtered.length?"excited":"thinking");
    scrollToListings();
  }

  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let oraRecognition=null, oraIsListening=false;

  function setOraListeningState(on){
    oraIsListening=on;
    if(!oraMicButton)return;
    oraMicButton.classList.toggle("listening",on);
    oraMicButton.setAttribute("aria-pressed",String(on));
    const icon=oraMicButton.querySelector(".ora-mic-icon");
    if(icon)icon.textContent=on?"■":"🎤";
  }

  function setupOraVoiceSearch(){
    if(!oraMicButton)return;
    if(!SpeechRecognition){
      oraMicButton.disabled=true; oraMicButton.classList.add("unsupported");
      setOraVoiceStatus("Voice search isn’t supported in this browser.");
      return;
    }
    oraRecognition=new SpeechRecognition();
    oraRecognition.lang="en-MY"; oraRecognition.interimResults=true; oraRecognition.continuous=false; oraRecognition.maxAlternatives=1;
    oraRecognition.addEventListener("start",()=>{setOraListeningState(true);openOra();setOraMessage("I'm listening... 👂🌱");setOraVoiceStatus("Listening…");reactOra("thinking");});
    oraRecognition.addEventListener("result",event=>{
      let transcript="",finalText="";
      for(let i=event.resultIndex;i<event.results.length;i+=1){
        const phrase=event.results[i][0]?.transcript||""; transcript+=phrase;
        if(event.results[i].isFinal)finalText+=phrase;
      }
      const spoken=(finalText||transcript).trim();
      if(spoken){setOraVoiceStatus(`Heard: “${spoken}”`);}
      if(finalText.trim())setTimeout(()=>handleOraSearch(finalText.trim()),180);
    });
    oraRecognition.addEventListener("error",event=>{
      setOraListeningState(false);
      const msg=(event.error==="not-allowed"||event.error==="service-not-allowed")
        ?"I couldn't access your microphone 🥹 Please allow mic permission and try again."
        :event.error==="no-speech"?"I didn't catch anything 👂 Try again."
        :"Voice search had a tiny hiccup 🥹 Try tapping the mic again.";
      setOraVoiceStatus(msg);setOraMessage(msg);reactOra("thinking");
    });
    oraRecognition.addEventListener("end",()=>setOraListeningState(false));
    oraMicButton.addEventListener("click",()=>{
      openOra();
      if(oraIsListening){try{oraRecognition.stop();}catch(e){setOraListeningState(false);}return;}
      try{oraRecognition.start();}catch(e){setOraListeningState(false);setOraVoiceStatus("Give me one sec, then try again 🎤");}
    });
  }

  // ---------------------------------------------------------
  // ORA - PHASE 2: MARKETPLACE ACTIONS
  // ---------------------------------------------------------
  function handleOraAction(action) {
    openOra();

    if (action === "class") {
      resetMarketplaceFilters();

      oraCategoryFilter = ["Books", "Lab Equipment", "Tech"];
      oraIntentLabel = "📚 Ora: For class";

      setOraMessage("Study mode activated 📚 I found class-friendly picks for you!");
      reactOra("excited");
      render();
      scrollToListings();
      return;
    }

    if (action === "room") {
      resetMarketplaceFilters();

      oraCategoryFilter = ["Home"];
      oraIntentLabel = "🏠 Ora: For my room";

      setOraMessage("Room glow-up time 🏠 Here are some home finds!");
      reactOra("excited");
      render();
      scrollToListings();
      return;
    }

    if (action === "cheap") {
      resetMarketplaceFilters();

      sortSelect.value = "Price: low to high";
      oraIntentLabel = "💸 Ora: Budget finds";

      setOraMessage("Say less 💸 I put the cheapest available finds first!");
      reactOra("excited");
      render();
      scrollToListings();
      return;
    }

    if (action === "surprise") {
      surpriseMe();
    }
  }

  function surpriseMe() {
    const available = listings.filter((item) => item.status === "Available");

    if (!available.length) {
      setOraMessage("Hmm... I don't have anything to surprise you with yet 🥹");
      reactOra("thinking");
      return;
    }

    resetMarketplaceFilters();

    const randomIndex = Math.floor(Math.random() * available.length);
    const surpriseItem = available[randomIndex];

    oraIntentLabel = "✨ Ora's surprise";

    setOraMessage(`Ooo, how about “${surpriseItem.title}”? ✨`);
    reactOra("surprised");
    render();

    window.setTimeout(() => {
      const card = document.querySelector(
        `[data-listing-card="${surpriseItem.id}"]`,
      );

      if (!card) return;

      card.classList.add("ora-picked");
      card.scrollIntoView({ behavior: "smooth", block: "center" });

      window.setTimeout(() => {
        card.classList.remove("ora-picked");
      }, 2600);
    }, 80);
  }

  function scrollToListings() {
    const listingGrid = document.querySelector("#listingGrid");

    window.setTimeout(() => {
      listingGrid.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  oraClose.addEventListener("click", (event) => {
    event.stopPropagation();
    minimiseOra();
  });

  oraMascot.addEventListener("click", () => {
    if (oraWrapper.classList.contains("minimised")) {
      openOra();
    }
  });

  oraActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleOraAction(button.dataset.oraAction);
    });
  });

  setupOraVoiceSearch();

  // ---------------------------------------------------------
  // LISTINGS
  // ---------------------------------------------------------
  async function loadListings() {
    listings = await api("/listings");
    render();
  }

  function render() {
    const filtered = getFilteredListings();

    document.querySelector("#count").textContent =
      `${filtered.length} items available`;

    renderCategoryChips();
    renderListingCards(filtered);
  }

  function renderCategoryChips() {
    const chips = document.querySelector("#chips");

    const oraChip = oraIntentLabel
      ? `<button class="active ora-chip" data-clear-ora="true">${oraIntentLabel} ×</button>`
      : "";

    const categoryButtons = categories
      .map((item) => {
        const isActive = !oraIntentLabel && !oraCategoryFilter && category === item;

        return `<button class="${isActive ? "active" : ""}" data-category="${item}">${item}</button>`;
      })
      .join("");

    chips.innerHTML = oraChip + categoryButtons;

    document.querySelectorAll("[data-category]").forEach((button) => {
      button.onclick = () => {
        clearOraIntent();
        category = button.dataset.category;
        render();
      };
    });

    const clearOraButton = document.querySelector("[data-clear-ora]");

    if (clearOraButton) {
      clearOraButton.onclick = () => {
        clearOraIntent();
        category = "All";
        sortSelect.value = "Newest";
        setOraMessage("All cleared! What else are we feeling for today? 🌱");
        render();
      };
    }
  }

  function renderListingCards(filtered) {
    document.querySelector("#listingGrid").innerHTML = filtered.length
      ? filtered
          .map(
            (item) =>
              `<article class="listing" data-listing-card="${item.id}"><button class="listing-image" style="background:${item.colour}" data-details="${item.id}">${item.image ? `<img src="${item.image}" alt="${item.title}" />` : `<span>${item.emoji}</span>`}<small>${item.condition}</small></button><div class="listing-info"><button class="heart ${saved.includes(item.id) ? "saved" : ""}" data-save="${item.id}" aria-label="Save listing">${saved.includes(item.id) ? "♥" : "♡"}</button><span class="category">${item.category}</span><h3>${item.title}</h3><strong>RM ${Number(item.price).toFixed(2)}</strong><p><a class="listing-seller-link" href="/profile?userId=${item.sellerId}">${item.seller} ✓</a> · ${item.posted}</p></div></article>`,
          )
          .join("")
      : `<div class="empty"><span>🔎</span><h3>No treasures found</h3><p>Try another search or filter.</p></div>`;

    document.querySelectorAll("[data-details]").forEach((button) => {
      button.onclick = () => showDetails(Number(button.dataset.details));
    });

    document.querySelectorAll("[data-save]").forEach((button) => {
      button.onclick = () => toggleSave(Number(button.dataset.save));
    });
  }

  function toggleSave(id) {
    saved = saved.includes(id)
      ? saved.filter((item) => item !== id)
      : [...saved, id];

    localStorage.setItem("campusswap-saved", JSON.stringify(saved));
    render();

    toast(saved.includes(id) ? "Saved to favourites" : "Removed from favourites");
  }

  function showDetails(id) {
    location.href = `/item-details?id=${id}`;
  }

  async function requestItem(id) {
    const result = await api("/requests", {
      method: "POST",
      body: JSON.stringify({ listingId: id }),
    });

    closeDetails();
    toast(result.message);
  }

  async function reportItem(id) {
    const item = listings.find((entry) => entry.id === id);

    const result = await api("/reports", {
      method: "POST",
      body: JSON.stringify({
        listing: item.title,
        reason: "Listing reported by a student",
      }),
    });

    closeDetails();
    toast(result.message);
  }

  function closeDetails() {
    document.querySelector("#detailModal")?.classList.remove("open");
  }

  window.toggleSave = toggleSave;
  window.requestItem = requestItem;
  window.reportItem = reportItem;
  window.closeDetails = closeDetails;

  // Search can refine Ora's recommendations, so we do not clear
  // Ora's intent when the student types in the search bar.
  searchInput.addEventListener("input", render);
  conditionSelect.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  setupOra();
  loadListings().catch((error) => toast(error.message));
})();