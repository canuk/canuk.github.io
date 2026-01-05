import React, { useState, useEffect } from 'react';
import { Home, UserCircle, ChevronLeft, ChevronRight, Award, Zap, CheckCircle2, Trophy, Star } from 'lucide-react';

const MarioKartCombinedApp = () => {
  const [activeTab, setActiveTab] = useState('mood'); // 'mood' or 'personality'
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-500 to-blue-300 flex flex-col items-center pt-8 pb-16 px-4">
      {/* Header */}
      <header className="text-center mb-8">
        <div className="bg-red-600 rounded-xl px-8 py-4 shadow-lg inline-block mb-3 transform hover:scale-105 transition-transform duration-300">
          <h1 className="text-4xl md:text-5xl font-bold text-white">Mario Kart Match</h1>
        </div>
        <div className="bg-yellow-400 rounded-full px-6 py-2 shadow-md">
          <p className="text-lg text-blue-900 font-bold">Find your perfect racing style!</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="w-full max-w-3xl flex mb-1">
        <button 
          className={`flex items-center justify-center px-6 py-3 font-bold text-lg rounded-t-lg transition-all ${
            activeTab === 'mood' 
              ? 'bg-white text-blue-600 border-t-2 border-l-2 border-r-2 border-blue-300' 
              : 'bg-blue-500 text-white hover:bg-blue-400'
          }`}
          onClick={() => setActiveTab('mood')}
        >
          <Star className="mr-2" size={20} />
          Mood Matcher
        </button>
        <button 
          className={`flex items-center justify-center px-6 py-3 font-bold text-lg rounded-t-lg transition-all ${
            activeTab === 'personality' 
              ? 'bg-white text-blue-600 border-t-2 border-l-2 border-r-2 border-blue-300' 
              : 'bg-blue-500 text-white hover:bg-blue-400'
          }`}
          onClick={() => setActiveTab('personality')}
        >
          <UserCircle className="mr-2" size={20} />
          Personality Quiz
        </button>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-3xl">
        {activeTab === 'mood' ? <MoodMatcher /> : <PersonalityQuiz />}
      </main>
      
      {/* Footer */}
      <footer className="mt-8 text-center">
        <div className="bg-white px-6 py-3 rounded-full shadow-md inline-block">
          <p className="text-blue-800 font-bold">Find your perfect Mario Kart match!</p>
        </div>
        <div className="mt-4 bg-red-600 text-white px-5 py-2 rounded-lg shadow-md inline-block">
          <p className="flex items-center justify-center">
            <span className="mr-2 text-yellow-300">★</span>
            Created with ❤️ for Mario Kart fans everywhere
            <span className="ml-2 text-yellow-300">★</span>
          </p>
        </div>
        <div className="mt-6 text-xs text-white opacity-80">
          <p>Based on Mario Kart 8 Deluxe for Nintendo Switch</p>
        </div>
      </footer>
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-300 rounded-md shadow-md transform rotate-12 opacity-70 hidden md:block"></div>
      <div className="absolute bottom-20 right-10 w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-300 rounded-md shadow-md transform -rotate-12 opacity-70 hidden md:block"></div>
      <div className="absolute top-1/4 right-16 w-8 h-8 bg-gradient-to-br from-red-400 to-red-300 rounded-md shadow-md transform rotate-45 opacity-70 hidden md:block"></div>
      <div className="absolute bottom-1/3 left-16 w-8 h-8 bg-gradient-to-br from-green-400 to-green-300 rounded-md shadow-md transform -rotate-45 opacity-70 hidden md:block"></div>
    </div>
  );
};

// Mood Matcher Component
const MoodMatcher = () => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [animateRandom, setAnimateRandom] = useState(false);
  
  // Reset state when mood changes
  useEffect(() => {
    setShowRecommendation(false);
  }, [selectedMood]);

  const handleMoodSelect = (moodId) => {
    setSelectedMood(moodId);
    setTimeout(() => {
      setShowRecommendation(true);
    }, 500);
  };

  const handleRandomMood = () => {
    setAnimateRandom(true);
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * moodOptions.length);
      setSelectedMood(moodOptions[randomIndex].id);
      setAnimateRandom(false);
      setTimeout(() => {
        setShowRecommendation(true);
      }, 500);
    }, 1200);
  };

  // Mood options
  const moodOptions = [
    { id: 'competitive', name: 'Competitive/Victory-focused', emoji: '🏆' },
    { id: 'laidback', name: 'Laid-back/Casual', emoji: '😎' },
    { id: 'chaotic', name: 'Chaotic/Unpredictable', emoji: '🌪️' },
    { id: 'nostalgic', name: 'Nostalgic/Traditional', emoji: '🕰️' },
    { id: 'quirky', name: 'Quirky/Standing Out', emoji: '🤪' },
    { id: 'stylish', name: 'Stylish/Fashionable', emoji: '💅' },
    { id: 'edgy', name: 'Edgy/Rebellious', emoji: '😈' },
    { id: 'cute', name: 'Cute/Adorable', emoji: '🥰' },
    { id: 'powerful', name: 'Powerful/Dominant', emoji: '💪' },
    { id: 'balanced', name: 'Balanced/Versatile', emoji: '⚖️' }
  ];

  // Recommendations based on moods
  const recommendations = {
    competitive: {
      character: 'Funky Kong',
      kart: 'Wild Wiggler',
      wheels: 'Roller',
      glider: 'Super Glider',
      explanation: "You're all about winning! Funky Kong with the Wild Wiggler, Roller wheels, and Super Glider gives you incredible speed, acceleration, and drift capabilities to leave opponents in the dust. This combo is perfect for those who want to be first across the finish line, every time."
    },
    laidback: {
      character: 'Toad',
      kart: 'Standard Kart',
      wheels: 'Standard',
      glider: 'Cloud Glider',
      explanation: "You're here for a good time, not a stressful one. Toad with the Standard Kart, Standard wheels, and Cloud Glider offers balanced stats and easy handling, perfect for just cruising and enjoying the race without overthinking your strategy."
    },
    chaotic: {
      character: 'Waluigi',
      kart: 'Flame Rider',
      wheels: 'Monster',
      glider: 'Bowser Kite',
      explanation: "You thrive in unpredictable situations! Waluigi with the Flame Rider, Monster wheels, and Bowser Kite is perfect for causing mayhem and embracing the unexpected. This combo lets you recover quickly from crashes while maintaining good speed to keep the chaos flowing."
    },
    nostalgic: {
      character: 'Mario',
      kart: 'Pipe Frame',
      wheels: 'Blue Standard',
      glider: 'Parachute',
      explanation: "You appreciate the classics! Mario with the Pipe Frame, Blue Standard wheels, and Parachute is a throwback to simpler times, offering that traditional Mario Kart experience that's kept players coming back since the beginning."
    },
    quirky: {
      character: 'Shy Guy',
      kart: 'Biddybuggy',
      wheels: 'Button',
      glider: 'MKTV Parafoil',
      explanation: "You like to do things differently! Shy Guy with the Biddybuggy, Button wheels, and MKTV Parafoil is an unconventional but surprisingly effective combo that will raise eyebrows and possibly win races, perfect for those who never follow the crowd."
    },
    stylish: {
      character: 'Rosalina',
      kart: 'Cat Cruiser',
      wheels: 'Crimson Slim',
      glider: 'Flower Glider',
      explanation: "You race with elegance and flair! Rosalina with the Cat Cruiser, Crimson Slim wheels, and Flower Glider is not only visually stunning but offers a smooth driving experience with excellent drift capabilities, making you look good while performing well."
    },
    edgy: {
      character: 'Dry Bowser',
      kart: 'Bone Rattler',
      wheels: 'Metal',
      glider: 'Wario Wing',
      explanation: "You've got attitude to spare! Dry Bowser with the Bone Rattler, Metal wheels, and Wario Wing screams 'don't mess with me' and delivers with heavyweight power that can push opponents aside while maintaining intimidating speed."
    },
    cute: {
      character: 'Baby Peach',
      kart: 'Teddy Buggy',
      wheels: 'Azure Roller',
      glider: 'Peach Parasol',
      explanation: "You bring the adorable factor to every race! Baby Peach with the Teddy Buggy, Azure Roller wheels, and Peach Parasol creates the cutest combo on the track, with excellent acceleration and handling that belies its charming appearance."
    },
    powerful: {
      character: 'Bowser',
      kart: 'Badwagon',
      wheels: 'Hot Monster',
      glider: 'Plane Glider',
      explanation: "You're all about raw power! Bowser with the Badwagon, Hot Monster wheels, and Plane Glider creates an unstoppable force with top-tier weight and speed that can bulldoze through obstacles and opponents alike. Perfect for those who want to dominate the track."
    },
    balanced: {
      character: 'Luigi',
      kart: 'Mach 8',
      wheels: 'Cushion',
      glider: 'Parafoil',
      explanation: "You value versatility above all! Luigi with the Mach 8, Cushion wheels, and Parafoil gives you balanced stats across the board, making this combo adaptable to any track or racing situation. A solid choice for those who want to be prepared for anything."
    }
  };

  const selectedMoodData = selectedMood ? moodOptions.find(mood => mood.id === selectedMood) : null;
  const recommendation = selectedMood ? recommendations[selectedMood] : null;

  return (
    <div className="rounded-xl shadow-xl overflow-hidden relative">
      {/* Rainbow border effect */}
      <div className="absolute inset-0 p-1 bg-gradient-to-r from-red-500 via-yellow-300 via-green-400 via-blue-500 to-purple-600 animate-pulse">
        <div className="absolute inset-0 bg-white rounded-lg"></div>
      </div>
      
      {/* Mood Selection Section */}
      <div className="relative p-6 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-t-lg">
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-r from-blue-800 to-blue-600 opacity-50"></div>
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <span className="bg-yellow-400 text-blue-900 rounded-full w-8 h-8 flex items-center justify-center mr-2">?</span>
          What's your racing mood today?
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {moodOptions.map(mood => (
            <button
              key={mood.id}
              onClick={() => handleMoodSelect(mood.id)}
              className={`p-3 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center ${
                selectedMood === mood.id 
                  ? 'bg-yellow-400 text-blue-900 font-bold shadow-inner' 
                  : 'bg-blue-500 hover:bg-blue-400'
              }`}
            >
              <span className="mr-2 text-xl">{mood.emoji}</span>
              <span>{mood.name}</span>
              {selectedMood === mood.id && <CheckCircle2 size={18} className="ml-2" />}
            </button>
          ))}
        </div>
        
        <div className="mt-6 flex justify-center">
          <button 
            onClick={handleRandomMood}
            className={`bg-gradient-to-r from-red-600 to-red-400 hover:from-red-500 hover:to-red-300 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform ${
              animateRandom ? 'animate-spin' : 'hover:scale-105'
            }`}
          >
            🎲 Random Mood! 🎲
          </button>
        </div>
      </div>

      {/* Recommendation Section */}
      {selectedMood && (
        <div className="relative p-6 bg-white">
          <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center">
            {selectedMoodData && (
              <>
                <span className="flex items-center justify-center bg-blue-600 text-white w-10 h-10 rounded-full mr-3">
                  {selectedMoodData.emoji}
                </span>
                <span className="bg-gradient-to-r from-blue-600 to-blue-400 text-transparent bg-clip-text">
                  {selectedMoodData.name} Mood
                </span>
              </>
            )}
          </h2>
          
          <div className={`transition-all duration-500 ${
            showRecommendation 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-10'
          }`}>
            {recommendation && (
              <div className="mt-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-300 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-red-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-red-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Character</h3>
                    </div>
                    <div className="bg-blue-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">👤</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{recommendation.character}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-blue-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-blue-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Kart</h3>
                    </div>
                    <div className="bg-red-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🏎️</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{recommendation.kart}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-purple-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-purple-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Wheels</h3>
                    </div>
                    <div className="bg-purple-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🛞</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{recommendation.wheels}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-green-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-green-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Glider</h3>
                    </div>
                    <div className="bg-green-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🪂</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{recommendation.glider}</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-5 border-2 border-yellow-300 shadow-md">
                  <h3 className="text-lg font-bold text-blue-800 mb-3 flex items-center">
                    <span className="bg-yellow-400 p-1 rounded-full mr-2">💡</span>
                    Why This Combo?
                  </h3>
                  <p className="text-gray-800 text-lg">{recommendation.explanation}</p>
                  
                  <div className="mt-4 bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-blue-800 italic text-center">
                      "If you're in a <span className="font-bold text-red-500">{selectedMoodData.name.toLowerCase()}</span> mood, this is the kart for you!"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Personality Quiz Component
const PersonalityQuiz = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [personality, setPersonality] = useState(null);
  const [animateResults, setAnimateResults] = useState(false);

  // Questions for the personality quiz
  const questions = [
    {
      id: 'q1',
      text: 'I prefer taking shortcuts even if they are risky.',
      type: 'agreement',
      trait: 'riskTaking'
    },
    {
      id: 'q2',
      text: 'When I play, winning is more important than having fun.',
      type: 'agreement',
      trait: 'competitive'
    },
    {
      id: 'q3',
      text: 'How often do you use items strategically rather than right away?',
      type: 'frequency',
      trait: 'strategic'
    },
    {
      id: 'q4',
      text: 'I enjoy using heavy characters that can push others out of the way.',
      type: 'agreement',
      trait: 'aggressive'
    },
    {
      id: 'q5',
      text: 'How often do you drift around corners to get mini-turbo boosts?',
      type: 'frequency',
      trait: 'technical'
    },
    {
      id: 'q6',
      text: 'I\'m more focused on having a good-looking character and kart than on stats.',
      type: 'agreement',
      trait: 'stylish'
    },
    {
      id: 'q7',
      text: 'How often do you find yourself helping other players during multiplayer games?',
      type: 'frequency',
      trait: 'supportive'
    },
    {
      id: 'q8',
      text: 'I get frustrated when things don\'t go my way in a race.',
      type: 'agreement',
      trait: 'temperamental'
    },
    {
      id: 'q9',
      text: 'I prefer courses that are straightforward rather than complex and full of obstacles.',
      type: 'agreement',
      trait: 'simplicity'
    },
    {
      id: 'q10',
      text: 'How often do you experiment with different character and kart combinations?',
      type: 'frequency',
      trait: 'experimental'
    }
  ];

  // Likert scale options
  const agreementOptions = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' }
  ];

  const frequencyOptions = [
    { value: 1, label: 'Almost Never' },
    { value: 2, label: 'Rarely' },
    { value: 3, label: 'Sometimes' },
    { value: 4, label: 'Often' },
    { value: 5, label: 'Almost Always' }
  ];

  // Define personality types and their corresponding setups
  const personalityTypes = {
    speedDemon: {
      title: "Speed Demon",
      description: "You live for the thrill of high-speed racing! You're all about going fast and taking risks, even if it means occasionally flying off the track. You prefer straightforward courses where you can really let loose and show off your speed.",
      character: "Dry Bowser",
      kart: "Circuit Special",
      wheels: "Slick",
      glider: "Super Glider",
      explanation: "This powerful combo maximizes speed and acceleration, perfect for straightaway bursts. Dry Bowser adds weight to prevent being pushed around, while the Circuit Special with Slick wheels gives you incredible top speed. The Super Glider helps with those risky jumps you love to take!"
    },
    technicalMaster: {
      title: "Technical Master",
      description: "You approach Mario Kart like a science, mastering every technique from drift-boosting to item strategy. You excel on technical courses with lots of turns where your precision shines. While others might have raw speed, your technical prowess puts you ahead.",
      character: "Yoshi",
      kart: "Sport Bike",
      wheels: "Roller",
      glider: "Cloud Glider",
      explanation: "This setup is perfect for technical players who value handling and acceleration over raw speed. Yoshi provides balanced stats, while the Sport Bike gives you inside drifting for tight corners. Roller wheels maximize acceleration and mini-turbo potential, with the Cloud Glider adding a handling boost."
    },
    strategist: {
      title: "The Strategist",
      description: "You're always thinking two steps ahead. You know exactly when to use items, when to take shortcuts, and how to set traps for opponents. Every race is a chess match, and you're the grandmaster plotting the perfect path to victory.",
      character: "Waluigi",
      kart: "Wild Wiggler",
      wheels: "Azure Roller",
      glider: "Paper Glider",
      explanation: "This combination gives you the versatility a strategic player needs. Waluigi has good speed without sacrificing handling, the Wild Wiggler provides excellent mini-turbo stats, and Azure Roller wheels give you quick acceleration. The Paper Glider rounds out this setup by adding extra control for precise maneuvering."
    },
    battleMaster: {
      title: "Battle Master",
      description: "You're all about the combat aspect of Mario Kart! You'd rather take down opponents with well-placed shells and bananas than worry about clean racing. For you, the best defense is a good offense, and you're always looking for the next opportunity to strike.",
      character: "King Boo",
      kart: "Splat Buggy",
      wheels: "Off-Road",
      glider: "Bowser Kite",
      explanation: "This aggressive setup lets you focus on what you do best - causing chaos! King Boo gives you good weight and handling, the Splat Buggy provides solid acceleration and off-road capability, and the Off-Road wheels keep you moving no matter the terrain. The Bowser Kite adds a touch of air handling for those post-jump item deployments."
    },
    stylishCruiser: {
      title: "Stylish Cruiser",
      description: "For you, looking good is just as important as racing well. You choose your setup based on aesthetics and enjoy showcasing your personality through your character and kart choices. Racing isn't just about winning—it's about making a statement while doing it.",
      character: "Rosalina",
      kart: "Cat Cruiser",
      wheels: "Crimson Slim",
      glider: "Flower Glider",
      explanation: "This elegant setup perfectly matches your desire for style and performance. Rosalina brings grace and poise, while the Cat Cruiser's sleek design turns heads. The Crimson Slim wheels add a pop of color, and the Flower Glider completes this visually stunning combination that still performs admirably on the track."
    },
    partyRacer: {
      title: "Party Racer",
      description: "You're in it for the fun and laughs! You don't stress about winning or losing—you're all about creating memorable moments and enjoying the ride. You might not take the most optimal racing lines, but you're guaranteed to have the best time.",
      character: "Toad",
      kart: "Teddy Buggy",
      wheels: "Button",
      glider: "Peach Parasol",
      explanation: "This adorable combo is all about having fun! Toad's cheerful personality matches your approach to racing, while the Teddy Buggy brings whimsy to your driving style. Button wheels add to the cute factor, and the Peach Parasol tops off this delightful setup that emphasizes enjoyment over pure performance."
    },
    adaptiveRacer: {
      title: "Adaptive Racer",
      description: "You're the ultimate all-rounder, able to adapt to any situation the race throws at you. Whether it's a technical course, a battle mode, or a straightaway speed challenge, you adjust your strategy on the fly and always remain competitive.",
      character: "Luigi",
      kart: "Standard Bike",
      wheels: "Standard",
      glider: "MKTV Parafoil",
      explanation: "This balanced setup gives you versatility for any racing situation. Luigi provides well-rounded stats, while the Standard Bike offers a good mix of speed and handling. Standard wheels ensure consistent performance on all terrains, and the MKTV Parafoil adds just enough glide for those longer jumps without sacrificing control."
    },
    classicPurist: {
      title: "Classic Purist",
      description: "You appreciate the traditional Mario Kart experience and prefer to stick with the classics. You likely have been playing since the early games and value consistency and familiarity in your racing approach.",
      character: "Mario",
      kart: "Pipe Frame",
      wheels: "Blue Standard",
      glider: "Super Glider",
      explanation: "This nostalgic setup pays homage to the classic Mario Kart experience you love. Mario is the original racer with balanced stats, while the Pipe Frame kart evokes the classic go-kart feel from earlier games. Blue Standard wheels provide reliable performance, and the Super Glider keeps things simple and effective."
    }
  };

  // Function to handle answer selection
  const handleAnswerSelect = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
  };

  // Navigate to the next question or complete the quiz
  const handleNextStep = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Analyze answers and determine personality type
      analyzePersonality();
      setQuizCompleted(true);
      
      // Animate results after a short delay
      setTimeout(() => {
        setAnimateResults(true);
      }, 500);
    }
  };

  // Navigate to the previous question
  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

      // Analyze answers to determine personality type
  const analyzePersonality = () => {
    // Calculate scores for different traits
    const scores = {
      riskTaking: answers.q1 || 3,
      competitive: answers.q2 || 3,
      strategic: answers.q3 || 3,
      aggressive: answers.q4 || 3,
      technical: answers.q5 || 3,
      stylish: answers.q6 || 3,
      supportive: answers.q7 || 3,
      temperamental: answers.q8 || 3,
      simplicity: answers.q9 || 3,
      experimental: answers.q10 || 3
    };

    // Determine dominant traits and assign personality type
    if (scores.riskTaking >= 4 && scores.competitive >= 4 && scores.simplicity >= 3) {
      setPersonality(personalityTypes.speedDemon);
    } else if (scores.technical >= 4 && scores.strategic >= 3 && scores.experimental >= 3) {
      setPersonality(personalityTypes.technicalMaster);
    } else if (scores.strategic >= 4 && scores.experimental >= 3) {
      setPersonality(personalityTypes.strategist);
    } else if (scores.aggressive >= 4 && scores.temperamental >= 3) {
      setPersonality(personalityTypes.battleMaster);
    } else if (scores.stylish >= 4) {
      setPersonality(personalityTypes.stylishCruiser);
    } else if (scores.supportive >= 4 && scores.competitive <= 2) {
      setPersonality(personalityTypes.partyRacer);
    } else if (scores.experimental >= 4) {
      setPersonality(personalityTypes.adaptiveRacer);
    } else {
      setPersonality(personalityTypes.classicPurist);
    }
  };

  // Restart the quiz
  const handleRestartQuiz = () => {
    setAnswers({});
    setCurrentStep(0);
    setQuizCompleted(false);
    setAnimateResults(false);
    setPersonality(null);
  };

  // Determine if the next button should be disabled
  const isNextDisabled = () => {
    const currentQuestionId = questions[currentStep].id;
    return answers[currentQuestionId] === undefined;
  };

  return (
    <div className="rounded-xl shadow-xl overflow-hidden relative">
      {/* Rainbow border effect */}
      <div className="absolute inset-0 p-1 bg-gradient-to-r from-red-500 via-yellow-300 via-green-400 via-blue-500 to-purple-600 animate-pulse">
        <div className="absolute inset-0 bg-white rounded-lg"></div>
      </div>

      {/* Quiz Content */}
      <div className="relative p-6 bg-white rounded-lg">
        {!quizCompleted ? (
          <>
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-300 h-4 transition-all duration-300 ease-out"
                  style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
                >
                </div>
              </div>
              <div className="flex justify-between mt-1 text-sm text-gray-600">
                <span>Question {currentStep + 1} of {questions.length}</span>
                <span>{Math.round(((currentStep + 1) / questions.length) * 100)}% Complete</span>
              </div>
            </div>

            {/* Current Question */}
            <div className="bg-blue-50 rounded-lg p-5 mb-6 border-2 border-blue-100 shadow-md">
              <h2 className="text-xl font-bold text-blue-800 mb-4">
                {questions[currentStep].text}
              </h2>
              
              <div className="mt-4">
                {questions[currentStep].type === 'agreement' ? (
                  // Agreement Scale
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {agreementOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAnswerSelect(questions[currentStep].id, option.value)}
                        className={`p-3 rounded-lg transition-all transform hover:scale-105 text-center ${
                          answers[questions[currentStep].id] === option.value 
                            ? 'bg-blue-500 text-white font-bold shadow-inner' 
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Frequency Scale
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    {frequencyOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleAnswerSelect(questions[currentStep].id, option.value)}
                        className={`p-3 rounded-lg transition-all transform hover:scale-105 text-center ${
                          answers[questions[currentStep].id] === option.value 
                            ? 'bg-green-500 text-white font-bold shadow-inner' 
                            : 'bg-green-100 hover:bg-green-200 text-green-800'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <button
                onClick={handlePreviousStep}
                disabled={currentStep === 0}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  currentStep === 0 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-400 shadow-md hover:shadow-lg'
                }`}
              >
                <ChevronLeft size={20} className="mr-1" />
                Previous
              </button>
              
              <button
                onClick={handleNextStep}
                disabled={isNextDisabled()}
                className={`flex items-center px-4 py-2 rounded-lg transition-all ${
                  isNextDisabled() 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 text-white hover:bg-blue-400 shadow-md hover:shadow-lg'
                }`}
              >
                {currentStep === questions.length - 1 ? 'Complete Quiz' : 'Next'}
                <ChevronRight size={20} className="ml-1" />
              </button>
            </div>
          </>
        ) : (
          // Results Section
          <div className={`transition-all duration-700 ${animateResults ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {personality && (
              <>
                <div className="text-center mb-6">
                  <div className="inline-block bg-yellow-400 text-blue-900 px-6 py-3 rounded-full font-bold text-xl mb-4 shadow-md">
                    Your Mario Kart Personality Is:
                  </div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">{personality.title}</h2>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-5 mb-6 border-2 border-blue-100 shadow-md">
                  <div className="flex items-start mb-4">
                    <Award size={24} className="text-yellow-500 mr-2 flex-shrink-0 mt-1" />
                    <p className="text-lg text-gray-800">{personality.description}</p>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
                  <Trophy size={24} className="text-yellow-500 mr-2" />
                  Your Recommended Setup:
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-red-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-red-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Character</h3>
                    </div>
                    <div className="bg-blue-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">👤</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{personality.character}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-blue-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-blue-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Kart</h3>
                    </div>
                    <div className="bg-red-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🏎️</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{personality.kart}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-purple-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-purple-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Wheels</h3>
                    </div>
                    <div className="bg-purple-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🛞</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{personality.wheels}</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 shadow-md text-center border-2 border-green-400 transform hover:scale-105 transition-transform duration-300">
                    <div className="bg-green-500 text-white rounded-t-lg py-2 -mt-4 -mx-4 mb-4">
                      <h3 className="text-lg font-bold">Glider</h3>
                    </div>
                    <div className="bg-green-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
                      <span className="text-3xl">🪂</span>
                    </div>
                    <p className="text-lg font-bold bg-yellow-100 rounded-full py-1">{personality.glider}</p>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-5 border-2 border-yellow-300 shadow-md mb-6">
                  <h3 className="text-lg font-bold text-blue-800 mb-3 flex items-center">
                    <Zap size={20} className="text-yellow-500 mr-2" />
                    Why This Setup Works For You:
                  </h3>
                  <p className="text-gray-800 text-lg">{personality.explanation}</p>
                </div>
                
                <div className="text-center mt-8">
                  <button
                    onClick={handleRestartQuiz}
                    className="bg-gradient-to-r from-red-600 to-red-400 hover:from-red-500 hover:to-red-300 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform hover:scale-105"
                  >
                    <CheckCircle2 size={20} className="inline mr-2" />
                    Take The Quiz Again
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarioKartCombinedApp; 