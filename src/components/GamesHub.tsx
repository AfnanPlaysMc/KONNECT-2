import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Play, RotateCcw, Award, Check, AlertCircle, HelpCircle, 
  ChevronRight, ArrowRight, Smile, Zap, Trash2, ShieldAlert, ArrowLeft
} from 'lucide-react';
import { LIST_OF_GAMES, MiniGame } from '../types';

interface GamesHubProps {
  onClose?: () => void;
  activeFriendId?: string;
  activeFriendName?: string;
  onSendGameResult?: (gameId: string, gameName: string, score: number, resultText: string) => void;
  initialLaunchGameId?: string | null;
}

export default function GamesHub({ onClose, activeFriendId, activeFriendName, onSendGameResult, initialLaunchGameId }: GamesHubProps) {
  const [selectedGame, setSelectedGame] = useState<MiniGame | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [highScore, setHighScore] = useState<Record<string, number>>({});

  // Auto-launch initial game if specified
  useEffect(() => {
    if (initialLaunchGameId) {
      const match = LIST_OF_GAMES.find(g => g.id === initialLaunchGameId);
      if (match) {
        setSelectedGame(match);
        setIsPlaying(true);
      }
    }
  }, [initialLaunchGameId]);

  // Load high scores
  useEffect(() => {
    const saved = localStorage.getItem('konnect_game_scores');
    if (saved) {
      try { setHighScore(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const saveScore = (gameId: string, score: number) => {
    const currentHigh = highScore[gameId] || 0;
    if (score > currentHigh) {
      const updated = { ...highScore, [gameId]: score };
      setHighScore(updated);
      localStorage.setItem('konnect_game_scores', JSON.stringify(updated));
    }
    
    // Auto send result to chat if in conversational context
    if (onSendGameResult && selectedGame) {
      let outcome = `scored ${score} pts!`;
      if (score === 1 && (gameId === 'tictactoe' || gameId === 'rockpaperscissors' || gameId === 'connect4')) {
        outcome = "won the match!";
      } else if (score === 0 && (gameId === 'tictactoe' || gameId === 'rockpaperscissors' || gameId === 'connect4')) {
        outcome = "lost the match.";
      } else if (score === -1) {
        outcome = "tied the match.";
      }
      onSendGameResult(gameId, selectedGame.name, score, outcome);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 text-slate-100">
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-slate-900 bg-slate-900/40">
        <div className="flex items-center gap-4">
          {onClose && (
            <button 
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-slate-800 transition active:scale-95"
              title="Go back to chat"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Chat</span>
            </button>
          )}

          <div className="w-px h-6 bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-lg text-white">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-lg text-white">Konnect Arcade</h3>
              <p className="text-xs text-slate-400">
                {activeFriendName ? `Challenging ${activeFriendName}` : 'Play 20 interactive mini-games'}
              </p>
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full text-slate-400 hover:text-white transition" title="Close Arcade">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {!isPlaying ? (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            {LIST_OF_GAMES.map((game) => {
              const score = highScore[game.id] || 0;
              return (
                <div 
                  key={game.id}
                  onClick={() => { setSelectedGame(game); setIsPlaying(true); }}
                  className="p-3.5 bg-slate-900/30 border border-slate-900 hover:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/60 transition group relative overflow-hidden"
                >
                  {/* Subtle Glowing Decor */}
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-indigo-500/5 rounded-full group-hover:bg-indigo-500/10 blur-xl transition" />
                  
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xl">🎮</span>
                    <h4 className="font-semibold text-sm text-slate-100 group-hover:text-indigo-400 transition">{game.name}</h4>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{game.description}</p>
                  
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{game.isTwoPlayer ? 'VS Friend/AI' : 'Solo Mode'}</span>
                    {score > 0 && <span className="text-emerald-500 font-semibold">Best: {score}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-[#05070a]">
          {/* Game Canvas Wrapper */}
          <div className="flex-1 overflow-hidden relative flex flex-col items-center justify-center p-4">
            {selectedGame && (
              <GameEngine 
                gameId={selectedGame.id} 
                onGameOver={(score) => saveScore(selectedGame.id, score)} 
                onBack={() => setIsPlaying(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// INDIVIDUAL GAME IMPLEMENTATIONS & SWITCHER
// ==========================================
interface GameEngineProps {
  gameId: string;
  onGameOver: (score: number) => void;
  onBack: () => void;
}

function GameEngine({ gameId, onGameOver, onBack }: GameEngineProps) {
  // Game states and logic
  const [board, setBoard] = useState<any>(null);
  const [turn, setTurn] = useState<'X' | 'O' | 'red' | 'yellow' | 'player' | 'ai'>('player');
  const [status, setStatus] = useState<string>('Play Game');
  const [gameScore, setGameScore] = useState<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    initGame();
  }, [gameId]);

  const initGame = () => {
    setGameOver(false);
    setGameScore(0);
    setStatus('In Progress');
    
    switch (gameId) {
      case 'tictactoe':
        setBoard(Array(9).fill(null));
        setTurn('player');
        break;
      case 'connect4':
        // Grid: 6 rows x 7 cols
        setBoard(Array(6).fill(null).map(() => Array(7).fill(null)));
        setTurn('player');
        break;
      case 'rockpaperscissors':
        setBoard({ player: null, opponent: null });
        break;
      case 'wordle':
        setBoard({
          secretWord: ['S', 'M', 'A', 'R', 'T'],
          guesses: Array(6).fill(''),
          currentRow: 0
        });
        break;
      case 'hangman':
        const words = ['KONNECT', 'ARCADE', 'MESSENGER', 'DEVELOPER', 'FIREBASE', 'REACT'];
        const selected = words[Math.floor(Math.random() * words.length)];
        setBoard({
          word: selected,
          guessed: [],
          remaining: 6
        });
        break;
      case 'memory':
        const icons = ['🌟', '🔥', '⚡', '💧', '🎵', '❤️', '🍀', '🍕'];
        const pairs = [...icons, ...icons].sort(() => Math.random() - 0.5);
        setBoard({
          cards: pairs.map((icon, id) => ({ id, icon, matched: false, flipped: false })),
          selected: []
        });
        break;
      case 'simonsays':
        setBoard({
          sequence: [Math.floor(Math.random() * 4)],
          playerSequence: [],
          isShowing: true,
          activeColor: null
        });
        break;
      case 'math':
        generateMathProblem();
        break;
      case 'colormatch':
        generateColorMatchProblem();
        break;
      case 'slidepuzzle':
        const numbers = [...Array(15).keys()].map(x => x + 1);
        numbers.push(0); // empty slot
        // simple shuffle
        for (let i = numbers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        setBoard(numbers);
        break;
      case 'trivia':
        const questions = [
          { q: 'Which company created the Konnect App?', a: ['Oxa LLC', 'Vite', 'Google', 'WhatsApp'], correct: 0 },
          { q: 'What database is Konnect built on?', a: ['Postgres', 'Firestore', 'SQLite', 'MongoDB'], correct: 1 },
          { q: 'What framework runs this app?', a: ['Vue', 'React', 'Angular', 'Svelte'], correct: 1 },
          { q: 'Which protocol handles custom voice call signalling?', a: ['HTTP', 'WebRTC', 'FTP', 'SMTP'], correct: 1 }
        ];
        setBoard({ qList: questions, idx: 0, score: 0 });
        break;
      default:
        // For physics/canvas based games (Snake, Pong, Flappy, Minesweeper, Tetris, etc.), canvas handles loop
        break;
    }
  };

  // Tic-Tac-Toe Move
  const makeTicTacToeMove = (idx: number) => {
    if (gameOver || board[idx] || turn !== 'player') return;
    
    const newBoard = [...board];
    newBoard[idx] = 'X';
    setBoard(newBoard);

    if (checkTicTacToeWinner(newBoard, 'X')) {
      setStatus('You Win!');
      setGameOver(true);
      onGameOver(1); // Winner score = 1
      return;
    }
    
    if (newBoard.every(x => x !== null)) {
      setStatus("It's a Tie!");
      setGameOver(true);
      onGameOver(-1); // Tie code = -1
      return;
    }

    setTurn('ai');
    setStatus('Opponent thinking...');
    
    // Simulate AI response
    setTimeout(() => {
      const empties = newBoard.map((val, i) => val === null ? i : null).filter(val => val !== null) as number[];
      if (empties.length > 0) {
        const randomMove = empties[Math.floor(Math.random() * empties.length)];
        newBoard[randomMove] = 'O';
        setBoard(newBoard);
        if (checkTicTacToeWinner(newBoard, 'O')) {
          setStatus('Opponent Wins!');
          setGameOver(true);
          onGameOver(0); // Loser score = 0
        } else if (newBoard.every(x => x !== null)) {
          setStatus("It's a Tie!");
          setGameOver(true);
          onGameOver(-1);
        } else {
          setTurn('player');
          setStatus('Your Turn');
        }
      }
    }, 600);
  };

  const checkTicTacToeWinner = (b: any[], p: string) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diags
    ];
    return lines.some(([x, y, z]) => b[x] === p && b[y] === p && b[z] === p);
  };

  // Connect Four Move
  const makeConnect4Move = (colIdx: number) => {
    if (gameOver || turn !== 'player') return;
    
    const newBoard = board.map((row: any) => [...row]);
    let placedRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (newBoard[r][colIdx] === null) {
        newBoard[r][colIdx] = 'X';
        placedRow = r;
        break;
      }
    }
    if (placedRow === -1) return; // Column full

    setBoard(newBoard);

    if (checkConnect4Winner(newBoard, 'X')) {
      setStatus('You Win!');
      setGameOver(true);
      onGameOver(1);
      return;
    }

    setTurn('ai');
    setStatus('Opponent thinking...');

    setTimeout(() => {
      // Simple AI column picker
      const validCols = [];
      for (let c = 0; c < 7; c++) {
        if (newBoard[0][c] === null) validCols.push(c);
      }
      if (validCols.length > 0) {
        const aiCol = validCols[Math.floor(Math.random() * validCols.length)];
        for (let r = 5; r >= 0; r--) {
          if (newBoard[r][aiCol] === null) {
            newBoard[r][aiCol] = 'O';
            break;
          }
        }
        setBoard(newBoard);
        if (checkConnect4Winner(newBoard, 'O')) {
          setStatus('Opponent Wins!');
          setGameOver(true);
          onGameOver(0);
        } else {
          setTurn('player');
          setStatus('Your Turn');
        }
      }
    }, 600);
  };

  const checkConnect4Winner = (b: any[][], player: string) => {
    // horizontal
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r][c+1] === player && b[r][c+2] === player && b[r][c+3] === player) return true;
      }
    }
    // vertical
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        if (b[r][c] === player && b[r+1][c] === player && b[r+2][c] === player && b[r+3][c] === player) return true;
      }
    }
    // diagonal down-right
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r+1][c+1] === player && b[r+2][c+2] === player && b[r+3][c+3] === player) return true;
      }
    }
    // diagonal up-right
    for (let r = 3; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === player && b[r-1][c+1] === player && b[r-2][c+2] === player && b[r-3][c+3] === player) return true;
      }
    }
    return false;
  };

  // Rock-Paper-Scissors
  const playRPS = (choice: 'rock' | 'paper' | 'scissors') => {
    if (gameOver) return;
    const items = ['rock', 'paper', 'scissors'] as const;
    const aiChoice = items[Math.floor(Math.random() * items.length)];
    setBoard({ player: choice, opponent: aiChoice });

    if (choice === aiChoice) {
      setStatus("It's a Draw!");
      setGameOver(true);
      onGameOver(-1);
    } else if (
      (choice === 'rock' && aiChoice === 'scissors') ||
      (choice === 'paper' && aiChoice === 'rock') ||
      (choice === 'scissors' && aiChoice === 'paper')
    ) {
      setStatus('You Win!');
      setGameOver(true);
      onGameOver(1);
    } else {
      setStatus('Opponent Wins!');
      setGameOver(true);
      onGameOver(0);
    }
  };

  // Wordle Move
  const submitWordle = (guess: string) => {
    if (gameOver || !board) return;
    const cleanGuess = guess.toUpperCase().trim();
    if (cleanGuess.length !== 5) return;

    const newGuesses = [...board.guesses];
    newGuesses[board.currentRow] = cleanGuess;
    
    const won = cleanGuess === 'SMART';
    const isLastRow = board.currentRow === 5;

    setBoard({
      ...board,
      guesses: newGuesses,
      currentRow: board.currentRow + 1
    });

    if (won) {
      setStatus('Word Solved!');
      setGameOver(true);
      const earned = (6 - board.currentRow) * 20;
      setGameScore(earned);
      onGameOver(earned);
    } else if (isLastRow) {
      setStatus('Game Over! Word was: SMART');
      setGameOver(true);
      onGameOver(0);
    }
  };

  // Hangman guess
  const guessHangman = (letter: string) => {
    if (gameOver || board.guessed.includes(letter)) return;
    
    const newGuessed = [...board.guessed, letter];
    const isCorrect = board.word.includes(letter);
    const newRemaining = isCorrect ? board.remaining : board.remaining - 1;

    // Check Win
    const hasWon = [...board.word].every(char => newGuessed.includes(char));

    setBoard({
      ...board,
      guessed: newGuessed,
      remaining: newRemaining
    });

    if (hasWon) {
      setStatus('Saved! You Guessed It.');
      setGameOver(true);
      const score = newRemaining * 15 + 10;
      setGameScore(score);
      onGameOver(score);
    } else if (newRemaining <= 0) {
      setStatus(`Hanged! Word: ${board.word}`);
      setGameOver(true);
      onGameOver(0);
    }
  };

  // Memory card click
  const flipMemoryCard = (cardId: number) => {
    if (gameOver || board.selected.length >= 2) return;
    const card = board.cards.find((c: any) => c.id === cardId);
    if (!card || card.matched || card.flipped) return;

    // Flip it
    const newCards = board.cards.map((c: any) => c.id === cardId ? { ...c, flipped: true } : c);
    const newSelected = [...board.selected, cardId];

    setBoard({ cards: newCards, selected: newSelected });

    if (newSelected.length === 2) {
      const [firstId, secondId] = newSelected;
      const first = board.cards.find((c: any) => c.id === firstId);
      const second = board.cards.find((c: any) => c.id === secondId);

      if (first.icon === second.icon) {
        // Match found
        setTimeout(() => {
          const matchedCards = newCards.map((c: any) => 
            c.id === firstId || c.id === secondId ? { ...c, matched: true, flipped: false } : c
          );
          const allMatched = matchedCards.every((c: any) => c.matched);
          
          setBoard({ cards: matchedCards, selected: [] });
          setGameScore(prev => prev + 10);

          if (allMatched) {
            setStatus('Memory Perfect!');
            setGameOver(true);
            onGameOver(100);
          }
        }, 500);
      } else {
        // Reset flip
        setTimeout(() => {
          const resetCards = newCards.map((c: any) => 
            c.id === firstId || c.id === secondId ? { ...c, flipped: false } : c
          );
          setBoard({ cards: resetCards, selected: [] });
        }, 1000);
      }
    }
  };

  // Math Problem Generation
  const generateMathProblem = () => {
    const num1 = Math.floor(Math.random() * 20) + 1;
    const num2 = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '*'] as const;
    const op = ops[Math.floor(Math.random() * ops.length)];
    let correctAns = 0;
    if (op === '+') correctAns = num1 + num2;
    if (op === '-') correctAns = num1 - num2;
    if (op === '*') correctAns = num1 * num2;

    const wrong1 = correctAns + Math.floor(Math.random() * 5) + 1;
    const wrong2 = correctAns - Math.floor(Math.random() * 5) - 1;
    const options = [correctAns, wrong1, wrong2].sort(() => Math.random() - 0.5);

    setBoard({
      problem: `${num1} ${op} ${num2} = ?`,
      options,
      correct: correctAns,
      streak: board?.streak || 0
    });
  };

  const solveMath = (val: number) => {
    if (gameOver) return;
    if (val === board.correct) {
      const newStreak = board.streak + 1;
      setGameScore(newStreak * 10);
      setBoard({ ...board, streak: newStreak });
      generateMathProblem();
    } else {
      setStatus(`Wrong! Score: ${gameScore}`);
      setGameOver(true);
      onGameOver(gameScore);
    }
  };

  // Color Match Stroop test
  const generateColorMatchProblem = () => {
    const colorNames = ['RED', 'GREEN', 'BLUE', 'YELLOW', 'PURPLE'];
    const colorHex = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'];
    
    const wordIdx = Math.floor(Math.random() * colorNames.length);
    const textColIdx = Math.floor(Math.random() * colorHex.length);
    const match = wordIdx === textColIdx;

    setBoard({
      word: colorNames[wordIdx],
      color: colorHex[textColIdx],
      isMatching: match,
      score: board?.score || 0
    });
  };

  const solveColorMatch = (choice: boolean) => {
    if (gameOver) return;
    if (choice === board.isMatching) {
      const nextScore = board.score + 10;
      setGameScore(nextScore);
      setBoard({ ...board, score: nextScore });
      generateColorMatchProblem();
    } else {
      setStatus(`Incorrect! Game Over.`);
      setGameOver(true);
      onGameOver(gameScore);
    }
  };

  // 15 Slide Puzzle Move
  const makeSlidePuzzleMove = (idx: number) => {
    if (gameOver) return;
    const emptyIdx = board.indexOf(0);
    const validMoves = [
      emptyIdx - 1, emptyIdx + 1, // sides
      emptyIdx - 4, emptyIdx + 4  // up down
    ];

    // check proximity & horizontal rows boundary check
    const isAdjacent = validMoves.includes(idx);
    if (!isAdjacent) return;

    const newBoard = [...board];
    newBoard[emptyIdx] = board[idx];
    newBoard[idx] = 0;
    setBoard(newBoard);

    // check victory
    const isWon = newBoard.slice(0, 15).every((num, i) => num === i + 1);
    if (isWon) {
      setStatus('Solved in record time!');
      setGameOver(true);
      onGameOver(150);
    }
  };

  // Simon sequence helper
  const playSimonStep = (colorIdx: number) => {
    if (gameOver) return;
    const newPlayerSeq = [...board.playerSequence, colorIdx];
    const seqStep = board.playerSequence.length;
    
    if (newPlayerSeq[seqStep] !== board.sequence[seqStep]) {
      setStatus('Wrong Sequence!');
      setGameOver(true);
      onGameOver(board.sequence.length * 10);
      return;
    }

    setBoard({
      ...board,
      playerSequence: newPlayerSeq
    });

    if (newPlayerSeq.length === board.sequence.length) {
      // Next sequence
      setGameScore(board.sequence.length * 10);
      setTimeout(() => {
        const nextSeq = [...board.sequence, Math.floor(Math.random() * 4)];
        setBoard({
          sequence: nextSeq,
          playerSequence: [],
          isShowing: true,
          activeColor: null
        });
      }, 800);
    }
  };

  // Trivia choice selection
  const selectTriviaAnswer = (choiceIdx: number) => {
    if (gameOver) return;
    const qItem = board.qList[board.idx];
    const isCorrect = choiceIdx === qItem.correct;
    const nextScore = isCorrect ? board.score + 25 : board.score;

    if (board.idx + 1 < board.qList.length) {
      setBoard({
        ...board,
        idx: board.idx + 1,
        score: nextScore
      });
    } else {
      setStatus(`Quiz Complete!`);
      setGameOver(true);
      onGameOver(nextScore);
    }
  };

  // CANVAS ENGINES FOR PHYSICS-BASED MINI GAMES
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let score = 0;

    if (gameId === 'snake') {
      let snake = [{ x: 10, y: 10 }];
      let dir = { x: 1, y: 0 };
      let apple = { x: 15, y: 15 };
      let gridCount = 20;

      const loop = () => {
        if (gameOver) return;
        // clear
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // draw apple
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        const size = canvas.width / gridCount;
        ctx.arc(apple.x * size + size/2, apple.y * size + size/2, size/2 - 2, 0, Math.PI * 2);
        ctx.fill();

        // move snake
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        
        // boundary checks
        if (head.x < 0 || head.x >= gridCount || head.y < 0 || head.y >= gridCount) {
          setGameOver(true);
          onGameOver(score);
          return;
        }

        // bite body checks
        if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          onGameOver(score);
          return;
        }

        snake.unshift(head);

        // eat apple check
        if (head.x === apple.x && head.y === apple.y) {
          score += 10;
          setGameScore(score);
          apple = {
            x: Math.floor(Math.random() * gridCount),
            y: Math.floor(Math.random() * gridCount)
          };
        } else {
          snake.pop();
        }

        // draw snake
        ctx.fillStyle = '#10b981';
        snake.forEach((segment, index) => {
          ctx.fillRect(segment.x * size + 1, segment.y * size + 1, size - 2, size - 2);
        });

        setTimeout(() => {
          animId = requestAnimationFrame(loop);
        }, 120);
      };

      // listener for arrow keys
      const handleKeys = (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' && dir.y === 0) dir = { x: 0, y: -1 };
        if (e.key === 'ArrowDown' && dir.y === 0) dir = { x: 0, y: 1 };
        if (e.key === 'ArrowLeft' && dir.x === 0) dir = { x: -1, y: 0 };
        if (e.key === 'ArrowRight' && dir.x === 0) dir = { x: 1, y: 0 };
      };
      window.addEventListener('keydown', handleKeys);
      loop();

      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('keydown', handleKeys);
      };
    }

    if (gameId === 'pong') {
      let ball = { x: 150, y: 100, vx: 3, vy: 2 };
      let playerY = 70;
      let aiY = 70;
      let paddleH = 40;
      let paddleW = 10;

      const loop = () => {
        if (gameOver) return;
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // move ball
        ball.x += ball.vx;
        ball.y += ball.vy;

        // wall bounce
        if (ball.y < 0 || ball.y > canvas.height - 10) ball.vy = -ball.vy;

        // AI follow ball
        if (aiY + paddleH/2 < ball.y) aiY += 2;
        else aiY -= 2;

        // Collision players
        if (ball.x < paddleW && ball.y > playerY && ball.y < playerY + paddleH) {
          ball.vx = -ball.vx;
          score += 5;
          setGameScore(score);
        }
        if (ball.x > canvas.width - paddleW - 10 && ball.y > aiY && ball.y < aiY + paddleH) {
          ball.vx = -ball.vx;
        }

        // Score check
        if (ball.x < 0) {
          setGameOver(true);
          onGameOver(score);
          return;
        }
        if (ball.x > canvas.width) {
          ball = { x: 150, y: 100, vx: -3, vy: 2 };
          score += 15;
          setGameScore(score);
        }

        // Draw elements
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(5, playerY, paddleW, paddleH);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(canvas.width - paddleW - 5, aiY, paddleW, paddleH);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ball.x, ball.y, 8, 8);

        animId = requestAnimationFrame(loop);
      };

      const handleMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        playerY = e.clientY - rect.top - paddleH/2;
      };
      canvas.addEventListener('mousemove', handleMove);
      loop();

      return () => {
        cancelAnimationFrame(animId);
        canvas.removeEventListener('mousemove', handleMove);
      };
    }

    if (gameId === 'flappy') {
      let birdY = 100;
      let birdVy = 0;
      let gravity = 0.4;
      let pipeX = 300;
      let pipeGap = 80;
      let pipeTop = 40;

      const loop = () => {
        if (gameOver) return;
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        birdVy += gravity;
        birdY += birdVy;

        pipeX -= 2.5;
        if (pipeX < -40) {
          pipeX = canvas.width;
          pipeTop = Math.floor(Math.random() * (canvas.height - pipeGap - 40)) + 20;
          score += 10;
          setGameScore(score);
        }

        // collisions
        if (birdY < 0 || birdY > canvas.height) {
          setGameOver(true);
          onGameOver(score);
          return;
        }

        if (pipeX < 40 && pipeX > 10) {
          if (birdY < pipeTop || birdY > pipeTop + pipeGap) {
            setGameOver(true);
            onGameOver(score);
            return;
          }
        }

        // draw pipe
        ctx.fillStyle = '#10b981';
        ctx.fillRect(pipeX, 0, 30, pipeTop);
        ctx.fillRect(pipeX, pipeTop + pipeGap, 30, canvas.height);

        // draw bird
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(30, birdY, 8, 0, Math.PI * 2);
        ctx.fill();

        animId = requestAnimationFrame(loop);
      };

      const handleTap = () => {
        birdVy = -5.5;
      };
      canvas.addEventListener('mousedown', handleTap);
      loop();

      return () => {
        cancelAnimationFrame(animId);
        canvas.removeEventListener('mousedown', handleTap);
      };
    }
  }, [gameId, gameOver]);

  return (
    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <h4 className="font-bold text-sm text-slate-200">
          {LIST_OF_GAMES.find(g => g.id === gameId)?.name || 'Mini Game'}
        </h4>
        <span className="text-xs bg-indigo-950/80 border border-indigo-900 px-2 py-0.5 rounded-full font-mono text-indigo-400">
          Score: {gameScore}
        </span>
      </div>

      {/* GAME RENDER SWITCHER */}
      <div className="w-full flex justify-center items-center py-4 bg-slate-950 rounded-xl overflow-hidden min-h-[220px]">
        {/* Tic-Tac-Toe */}
        {gameId === 'tictactoe' && board && (
          <div className="grid grid-cols-3 gap-2.5 w-44">
            {board.map((cell: any, idx: number) => (
              <button
                key={idx}
                onClick={() => makeTicTacToeMove(idx)}
                className="w-12 h-12 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-lg font-extrabold flex items-center justify-center transition-all text-white"
              >
                {cell === 'X' && <span className="text-indigo-400">X</span>}
                {cell === 'O' && <span className="text-fuchsia-400">O</span>}
              </button>
            ))}
          </div>
        )}

        {/* Connect Four */}
        {gameId === 'connect4' && board && (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1.5 justify-center mb-1">
              {[...Array(7).keys()].map(c => (
                <button
                  key={c}
                  onClick={() => makeConnect4Move(c)}
                  className="w-5 text-xs text-slate-500 hover:text-white transition font-bold"
                >
                  ↓
                </button>
              ))}
            </div>
            {board.map((row: any[], rIdx: number) => (
              <div key={rIdx} className="flex gap-1.5">
                {row.map((cell, cIdx) => (
                  <div key={cIdx} className="w-5 h-5 rounded-full border border-slate-800 flex items-center justify-center bg-slate-900">
                    {cell === 'X' && <div className="w-3.5 h-3.5 rounded-full bg-indigo-500" />}
                    {cell === 'O' && <div className="w-3.5 h-3.5 rounded-full bg-yellow-500" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Rock Paper Scissors */}
        {gameId === 'rockpaperscissors' && board && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-4">
              <button onClick={() => playRPS('rock')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-2xl hover:scale-105 active:scale-95 transition-all">✊</button>
              <button onClick={() => playRPS('paper')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-2xl hover:scale-105 active:scale-95 transition-all">✋</button>
              <button onClick={() => playRPS('scissors')} className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-2xl hover:scale-105 active:scale-95 transition-all">✌️</button>
            </div>
            {board.player && (
              <div className="text-xs text-slate-400 flex gap-4">
                <span>You: <strong className="text-white uppercase">{board.player}</strong></span>
                <span>Opponent: <strong className="text-white uppercase">{board.opponent}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Wordle Guess */}
        {gameId === 'wordle' && board && (
          <div className="flex flex-col gap-2.5 items-center">
            <div className="grid gap-1.5">
              {board.guesses.map((guess: string, r: number) => (
                <div key={r} className="flex gap-1.5">
                  {[...Array(5).keys()].map(c => {
                    const char = guess[c] || '';
                    let bg = 'bg-slate-900';
                    if (char) {
                      if (char === board.secretWord[c]) bg = 'bg-emerald-600';
                      else if (board.secretWord.includes(char)) bg = 'bg-yellow-600';
                      else bg = 'bg-slate-800';
                    }
                    return (
                      <div key={c} className={`w-8 h-8 rounded border border-slate-800 text-sm font-bold flex items-center justify-center text-white ${bg}`}>
                        {char}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            {!gameOver && (
              <input
                type="text"
                maxLength={5}
                placeholder="Enter 5 letters"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitWordle((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                className="w-36 text-center text-xs py-1.5 bg-slate-900 border border-slate-800 rounded-lg placeholder-slate-600 text-white focus:outline-none focus:border-indigo-500 transition-all uppercase"
              />
            )}
          </div>
        )}

        {/* Hangman */}
        {gameId === 'hangman' && board && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-sm font-mono tracking-widest text-white text-lg">
              {[...board.word].map((char, i) => board.guessed.includes(char) ? char : '_').join(' ')}
            </div>
            <p className="text-xs text-rose-400 font-mono">Tries Left: {board.remaining}</p>
            <div className="flex flex-wrap gap-1 justify-center max-w-[280px]">
              {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(l => (
                <button
                  key={l}
                  disabled={board.guessed.includes(l)}
                  onClick={() => guessHangman(l)}
                  className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center border transition-all ${board.guessed.includes(l) ? 'bg-slate-950 border-slate-950 text-slate-700' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Memory match */}
        {gameId === 'memory' && board && (
          <div className="grid grid-cols-4 gap-2">
            {board.cards.map((card: any) => (
              <button
                key={card.id}
                onClick={() => flipMemoryCard(card.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-all border ${card.matched ? 'bg-slate-950/20 border-slate-950 opacity-40' : card.flipped ? 'bg-indigo-950 border-indigo-700 scale-105' : 'bg-slate-900 border-slate-800 hover:bg-slate-800'}`}
              >
                {(card.flipped || card.matched) ? card.icon : '❓'}
              </button>
            ))}
          </div>
        )}

        {/* Math Speed Challenge */}
        {gameId === 'math' && board && (
          <div className="flex flex-col items-center gap-4 text-center">
            <h5 className="text-lg font-bold text-white font-mono">{board.problem}</h5>
            <div className="flex gap-2.5">
              {board.options.map((opt: number, i: number) => (
                <button
                  key={i}
                  onClick={() => solveMath(opt)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-sm font-semibold rounded-xl text-white active:scale-95 transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Match (Stroop) */}
        {gameId === 'colormatch' && board && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="text-xs text-slate-500 font-mono">DOES THE TEXT WORD MATCH THE ACTUAL COLOR?</span>
            <h5 className="text-3xl font-extrabold tracking-wide" style={{ color: board.color }}>
              {board.word}
            </h5>
            <div className="flex gap-4">
              <button onClick={() => solveColorMatch(true)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">TRUE</button>
              <button onClick={() => solveColorMatch(false)} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl text-xs font-bold text-white">FALSE</button>
            </div>
          </div>
        )}

        {/* Slide 15 Puzzle */}
        {gameId === 'slidepuzzle' && board && (
          <div className="grid grid-cols-4 gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
            {board.map((num: number, idx: number) => (
              <button
                key={idx}
                onClick={() => makeSlidePuzzleMove(idx)}
                className={`w-9 h-9 rounded flex items-center justify-center font-bold text-xs transition-all border ${num === 0 ? 'bg-transparent border-transparent cursor-default' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-indigo-400'}`}
              >
                {num !== 0 && num}
              </button>
            ))}
          </div>
        )}

        {/* Trivia pursuit */}
        {gameId === 'trivia' && board && (
          <div className="flex flex-col items-center gap-3 p-2 text-center max-w-[280px]">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Question {board.idx + 1} of 4</span>
            <h5 className="text-xs font-bold text-slate-200">{board.qList[board.idx].q}</h5>
            <div className="flex flex-col gap-2 w-full">
              {board.qList[board.idx].a.map((opt: string, optIdx: number) => (
                <button
                  key={optIdx}
                  onClick={() => selectTriviaAnswer(optIdx)}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-left px-3 rounded-lg text-slate-300 transition-all hover:translate-x-1"
                >
                  {optIdx + 1}. {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Physics Canvas Games: Snake, Pong, Flappy */}
        {(gameId === 'snake' || gameId === 'pong' || gameId === 'flappy') && (
          <div className="relative flex flex-col items-center gap-2">
            <canvas ref={canvasRef} width={280} height={180} className="rounded-lg border border-slate-900 bg-[#05070a]" />
            <span className="text-[10px] text-slate-500 font-mono">
              {gameId === 'snake' ? 'Use keyboard ARROW KEYS to slide snake.' : gameId === 'pong' ? 'Slide MOUSE inside canvas to bounce.' : 'CLICK/TAP inside canvas to flap.'}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-indigo-400 font-mono uppercase tracking-widest my-2 h-4">{status}</p>

      <div className="flex gap-3 w-full mt-2">
        <button
          onClick={initGame}
          className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
        <button
          onClick={onBack}
          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-xl text-white flex items-center justify-center gap-1.5 active:scale-95 transition-all"
        >
          Arcade Lobby
        </button>
      </div>
    </div>
  );
}
