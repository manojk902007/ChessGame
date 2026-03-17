const PIECES = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
}

const START_FEN = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
]

let board = [];
let turn = 'White';
let selected = null;
let legalMoves = [];
let lastMove = null;
let enPassantTarget = null;
let castlingRights = { K: true, Q: true, k: true, q: true };
let moveHistory = [];
let capturedByWhite = [];
let capturedByBlack = [];
let boardFlipped = false;
let promotionPending = false;
let gameOver = false;
let gameMode = "manual";
let aiDifficulty = "Medium";

const boardEl = document.getElementById('chess-board');
const statusMsg = document.getElementById('status-message');
const tagWhite = document.getElementById('tag-white');
const tagBlack = document.getElementById('tag-black');
const moveListEl = document.getElementById('move-list');
const whiteCaptured = document.getElementById('white-captured');
const blackCaptured = document.getElementById('black-captured');
const promoteModal = document.getElementById('promo-modal');
const promoChoices = document.getElementById('promo-choices');
const gameoverTitle = document.getElementById('gameover-title');
const gameoverModal = document.getElementById('gameover-modal');
const gameoverSub = document.getElementById('gameover-sub');
const gameoverIcon = document.getElementById('gameover-icon');
const btnManual = document.getElementById('btn-manual');
const btnComputer = document.getElementById('btn-computer');
const aiEasy = document.getElementById('ai-easy');
const aiMedium = document.getElementById('ai-medium');
const aiHard = document.getElementById('ai-hard');

setAIDifficulty("Medium");

function setAIDifficulty(level) {
    aiDifficulty = level;

    aiEasy.classList.remove('active');
    aiMedium.classList.remove('active');
    aiHard.classList.remove('active');

    if (level === 'Easy') aiEasy.classList.add('active');
    else if (level === 'Medium') aiMedium.classList.add('active');
    else if (level === 'Hard') aiHard.classList.add('active');
}

aiEasy.addEventListener('click', () => setAIDifficulty('Easy'));
aiMedium.addEventListener('click', () => setAIDifficulty('Medium'));
aiHard.addEventListener('click', () => setAIDifficulty('Hard'));

btnManual.addEventListener('click', () => {
    gameMode = "manual";
    btnManual.classList.add('active');
    btnComputer.classList.remove('active');
    toggleAIDifficultyButtons(false);
});

btnComputer.addEventListener('click', () => {
    gameMode = "computer";
    btnComputer.classList.add('active');
    btnManual.classList.remove('active');
    toggleAIDifficultyButtons(true);
});

document.getElementById('btn-restart').addEventListener('click', initGame);
document.getElementById('btn-flip').addEventListener('click', () => {
    boardFlipped = !boardFlipped;
    renderBoard();
});
document.getElementById('gameover-restart').addEventListener('click', () => {
    gameoverModal.style.display = 'none';
    initGame();
});

const cloneBoard = (b) => b.map(r => [...r]);

const isWhite = (p) => p && p === p.toUpperCase();
const isBlack = (p) => p && p === p.toLowerCase();

const isOwn = (p, color) => color === 'White' ? isWhite(p) : isBlack(p);

const enemy = (color) => color === 'White' ? 'Black' : 'White';

const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

function findKing(b, color) {
    const king = color === 'White' ? 'K' : 'k';
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
            if (b[r][c] === king) return { row: r, col: c };
    return null;
}

function isInCheck(b, color) {
    const kingPos = findKing(b, color);
    if (!kingPos) return false; // King is captured, should be game over
    return isAttacked(b, kingPos.row, kingPos.col, enemy(color));
}

function isAttacked(b, r, c, attackerColor) {
    for(let ar=0; ar<8; ar++)
        for (let ac=0; ac<8; ac++) {
            const p = b[ar][ac];
            if (!p || !isOwn(p, attackerColor)) continue;
            if (canAttack(b, ar, ac, r, c)) return true;
        }
    return false;
}

function canAttack(b, fr, fc, tr, tc) {
    const p = b[fr][fc];
    if (!p) return false;
    const type = p.toLowerCase();
    const dr = tr - fr, dc = tc - fc;

    if (type === 'p') {
        const dir = isWhite(p) ? -1 : 1;
        return dr === dir && Math.abs(dc) === 1;
    }
    if (type === 'n') {
        return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    }
    if (type === 'k') {
        return Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0);
    }
    if (type === 'r' || type === 'q') {
        if (dr === 0 || dc === 0) {
            if (slideClear(b, fr, fc, tr, tc)) return true;
        }
    }
    if (type === 'b' || type === 'q') {
        if (Math.abs(dr) === Math.abs(dc)) {
            if (slideClear(b, fr, fc, tr, tc)) return true;
        }
    }
    return false;
}

function slideClear(b, fr, fc, tr, tc) {
    const sr= Math.sign(tr - fr), sc = Math.sign(tc - fc);
    let r = fr + sr, c = fc + sc;
    while (r !== tr || c !== tc) {
        if (b[r][c]) return false;
        r += sr; c += sc;
    }
    return true;
}

function pseudoMoves(b, fr, fc, color, epTarget, castling) {
    const p = b[fr][fc];
    if (!p || !isOwn(p, color)) return [];
    const type = p.toLowerCase();
    const moves = [];

    const add = (tr, tc, special=null) => {
        if (!onBoard(tr, tc)) return;
        if (isOwn(b[tr][tc], color)) return;
        moves.push({ row: tr, col: tc, special});
    };

    const slide = (dr, dc) => {
        let r = fr + dr, c = fc + dc;
        while (onBoard(r, c)) {
            if (isOwn(b[r][c], color)) break;
            const isCapture = !!b[r][c];
            add(r,c);
            if (isCapture) break;
            r += dr; c += dc;
        }
    };

    if (type === 'p') {
        const dir = isWhite(p) ? -1 : 1;
        const startRow = isWhite(p) ? 6 : 1;
        const promoRow = isWhite(p) ? 0 : 7;

        if (onBoard(fr + dir, fc) && !b[fr + dir][fc]) {
            const sp = (fr + dir === promoRow) ? 'promo' : undefined;
            moves.push({ row: fr + dir, col: fc, special: sp });
            if (fr === startRow && !b[fr + 2*dir][fc]) {
                moves.push({ row: fr + 2*dir, col: fc });
            }
        }

        for (let dc of [-1, 1]) {
            const r = fr + dir, c = fc + dc;
            if (!onBoard(r, c)) continue;
            if (b[r][c] && !isOwn(b[r][c], color)){
                const sp = (r === promoRow) ? 'promo' : undefined;
                moves.push({ row: r, col: c, special: sp });
            }
            if (epTarget && epTarget.row === r && epTarget.col === c) {
                const capturedPawn = b[fr][c];
                if (capturedPawn && !isOwn(capturedPawn, color) && capturedPawn.toLowerCase() === 'p') {
                    moves.push({ row: r, col: c, special: 'enpassant' });
                }
            }
        }

        return moves;
    }

    if (type === 'n') {
        for (const [dr, dc] of [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]]) {
            add(fr + dr, fc + dc);
        }

        return moves;
    }

    if (type === 'b' || type === 'q') {
        for (const [dr, dc] of [[-1,-1], [-1,1], [1,-1], [1,1]])
            slide(dr, dc);
    }

    if (type === 'r' || type === 'q') {
        for (const [dr, dc] of [[-1,0], [1,0], [0,-1], [0,1]])
            slide(dr, dc);
    }

    if (type === 'k') {
        for (const [dr, dc] of [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]) {
            add(fr + dr, fc + dc);
        }

        const row = color === 'White' ? 7 : 0;
        const rook = color === 'White' ? 'R' : 'r';
        if (fr === row && fc === 4) {
            const kskey = color === 'White' ? 'K' : 'k';
            if (castling[kskey] && b[row][7] === rook && !b[row][5] && !b[row][6] && !isAttacked(b, row, 4, enemy(color)) && !isAttacked(b, row, 5, enemy(color)) && !isAttacked(b, row, 6, enemy(color))) {
                moves.push({ row, col: 6, special: 'castle-k' });
            }
            const qskey = color === 'White' ? 'Q' : 'q';
            if (castling[qskey] && b[row][0] === rook && !b[row][1] && !b[row][2] && !b[row][3] && !isAttacked(b, row, 4, enemy(color)) && !isAttacked(b, row, 3, enemy(color)) && !isAttacked(b, row, 2, enemy(color))) {
                moves.push({ row, col: 2, special: 'castle-q' });
            }
        }
    }

    return moves;
}

function legalMovesFor(b, fr, fc, color, epTarget, castling) {
    const pseudo = pseudoMoves(b, fr, fc, color, epTarget, castling);
    return pseudo.filter(mv => {
        const nb = applyMoveToBoard(cloneBoard(b), fr, fc, mv, color);
        return !isInCheck(nb, color);
    });
}

function applyMoveToBoard(b, fr, fc, mv, color) {
    const {row: tr, col: tc, special} = mv;
    const p = b[fr][fc];

    b[tr][tc] = p;
    b[fr][fc] = null;

    if (special === 'enpassant') {
        const capturedRow = color === 'White' ? tr + 1 : tr - 1;
        b[capturedRow][tc] = null;
    }
    if (special === 'castle-k') {
        b[tr][5] = b[tr][7];
        b[tr][7] = null;
    }
    if (special === 'castle-q') {
        b[tr][3] = b[tr][0];
        b[tr][0] = null;
    }
    if (special === 'promo') {
        b[tr][tc] = color === 'White' ? 'Q' : 'q';
    }

    return b;
}

function removeCapturedRookCastlingRights(piece, row, col) {
    if (piece === 'R') {
        if (row === 7 && col === 7) castlingRights.K = false;
        if (row === 7 && col === 0) castlingRights.Q = false;
    }
    if (piece === 'r') {
        if (row === 0 && col === 7) castlingRights.k = false;
        if (row === 0 && col === 0) castlingRights.q = false;
    }
}

function hasAnyLegalMove(b, color, epTarget, castling) {
    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            if (!isOwn(b[r][c], color)) continue;
            if (legalMovesFor(b, r, c, color, epTarget, castling).length > 0) return true;
        }
    return false;
}

function initGame() {
    board = START_FEN.map(r => [...r]);
    turn = 'White';
    selected = null;
    legalMoves = [];
    lastMove = null;
    enPassantTarget = null;
    castlingRights = { K: true, Q: true, k: true, q: true };
    moveHistory = [];
    capturedByWhite = [];
    capturedByBlack = [];
    boardFlipped = false;
    promotionPending = false;
    gameOver = false;
    promoteModal.style.display = 'none';
    gameoverModal.style.display = 'none';

    if(gameMode === "manual") {
        btnManual.classList.add('active');
        btnComputer.classList.remove('active');
    } else {
        btnComputer.classList.add('active');
        btnManual.classList.remove('active');
    }
    
    toggleAIDifficultyButtons(gameMode === "computer");

    renderBoard();
    updateStatus();
    renderMoveHistory();
    renderCaptured();
}

function renderBoard() {
    boardEl.innerHTML = '';
    renderCoords();
    const checkedKing = isInCheck(board, turn) ? findKing(board, turn) : null;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const vr = boardFlipped ? 7 - r : r;
            const vc = boardFlipped ? 7 - c : c;
            const sq = document.createElement('div');
            sq.className = 'square' + ((vr + vc) % 2 === 0 ? ' light' : ' dark');
            sq.dataset.row = vr;
            sq.dataset.col = vc;

            if (selected && selected.row == vr && selected.col == vc)
                sq.classList.add('selected');
            if (lastMove && ((lastMove.from.row == vr && lastMove.from.col == vc) || (lastMove.to.row == vr && lastMove.to.col == vc)))
                sq.classList.add('last-move');

            if (checkedKing && checkedKing.row === vr && checkedKing.col === vc) {
                sq.classList.add('in-check');
            }

            const isLegal = legalMoves.some(mv => mv.row === vr && mv.col === vc);
            if (isLegal) {
                sq.classList.add(board[vr][vc] ? 'legal-capture' : 'legal-move');
            }

            if (board[vr][vc]) {
                const pieceEl = document.createElement('span');
                pieceEl.className = 'piece';
                pieceEl.textContent = PIECES[board[vr][vc]];
                sq.appendChild(pieceEl);
            }

            sq.addEventListener('click', () => onSquareClick(vr, vc));
            boardEl.appendChild(sq);
        }
    }
}

function renderCoords(){
    const ranks = ['8','7','6','5','4','3','2','1'];
    const files = ['a','b','c','d','e','f','g','h'];
    const dr = boardFlipped ? [...ranks].reverse() : ranks;
    const df = boardFlipped ? [...files].reverse() : files;

    const makeEl = (text, cls) => {
        const el = document.createElement('div');
        el.className = cls;
        el.textContent = text;
        return el;
    };

    ['coords-rank-left', 'coords-rank-right'].forEach(cls => {
        const el = document.getElementById(cls);
        el.innerHTML = '';
        dr.forEach(r => el.appendChild(makeEl(r, 'coord-label-side')));
    });
    ['coords-file-top', 'coords-file-bottom'].forEach(cls => {
        const el = document.getElementById(cls);
        el.innerHTML = '';
        df.forEach(f => el.appendChild(makeEl(f, 'coord-label')));
    });
}

function updateStatus() {
    tagWhite.classList.toggle('active', turn === 'White');
    tagBlack.classList.toggle('active', turn === 'Black');

    const inCheck = isInCheck(board, turn);
    if (inCheck) {
        statusMsg.textContent = `${cap(turn)} is in check!`;
    } else {
        statusMsg.textContent = `${cap(turn)}'s turn`;
    }
}

function renderMoveHistory() {
    moveListEl.innerHTML = '';
    moveHistory.forEach((m, i) => {
        const el = document.createElement('span');
        el.className = 'move-entry' + (i % 2 === 0 ? ' white-move' : ' black-move')
        el.textContent = (i%2 === 0 ? `${Math.floor(i/2)+1}. ` : '') + m;
        moveListEl.appendChild(el);
    });
    moveListEl.scrollLeft = moveListEl.scrollWidth;
}

function renderCaptured() {
    whiteCaptured.textContent = capturedByWhite.map(p => PIECES[p]).join(' ');
    blackCaptured.textContent = capturedByBlack.map(p => PIECES[p]).join(' ');
}

function onSquareClick(r, c) {
    if (gameOver || promotionPending) return;

    const mv = legalMoves.find(m => m.row === r && m.col === c);
    if (mv && selected) {
        executeMove(selected.row, selected.col, mv);
        return;
    }

    const piece = board[r][c];
    if (piece && isOwn(piece, turn)) {
        selected = { row: r, col: c };
        legalMoves = legalMovesFor(board, r, c, turn, enPassantTarget, castlingRights);
        renderBoard();
        return;
    }

    selected = null;
    legalMoves = [];
    renderBoard();
}

async function executeMove(fr, fc, mv) {
    const {row: tr, col: tc, special} = mv;
    const piece = board[fr][fc];
    const captured = board[tr][tc];

    selected = null;
    legalMoves = [];
    promotionPending = special === 'promo';

    let epCaptured = null;
    if (special === 'enpassant') {
        const cpRow = turn === 'White' ? tr + 1 : tr - 1;
        epCaptured = board[cpRow][tc];
        board[cpRow][tc] = null;
    }

    board[tr][tc] = piece;
    board[fr][fc] = null;

    if (special === 'castle-k') {
        board[tr][5] = board[tr][7];
        board[tr][7] = null;
    }
    if (special === 'castle-q') {
        board[tr][3] = board[tr][0];
        board[tr][0] = null;
    }

    if (piece === 'K') { castlingRights.K = false; castlingRights.Q = false; }
    if (piece === 'k') { castlingRights.k = false; castlingRights.q = false; }
    if (piece === 'R') {
        if (fr === 7 && fc === 7) castlingRights.K = false;
        if (fr === 7 && fc === 0) castlingRights.Q = false;
    }
    if (piece === 'r') {
        if (fr === 0 && fc === 7) castlingRights.k = false;
        if (fr === 0 && fc === 0) castlingRights.q = false;
    }
    removeCapturedRookCastlingRights(captured, tr, tc);

    enPassantTarget = null;
    if ((piece === 'P' || piece === 'p') && Math.abs(tr - fr) === 2) {
        enPassantTarget = { row: (fr + tr) / 2, col: fc };
    }

    const actualCaptured = epCaptured || captured;
    if (actualCaptured) {
        if (turn === 'White') capturedByWhite.push(actualCaptured);
        else capturedByBlack.push(actualCaptured);
    }

    if (special === 'promo') {
        const promoted = await askPromotion(turn);
        board[tr][tc] = promoted;
    }
    promotionPending = false;

    recordMove(piece, fr, fc, tr, tc, special, actualCaptured, board[tr][tc]);

    lastMove = { from: {row: fr, col: fc}, to: {row: tr, col: tc} };
    const nextTurn = enemy(turn);

    turn = nextTurn;

    renderBoard();
    renderMoveHistory();
    renderCaptured();
    updateStatus();

    const destSquare = boardEl.querySelector('[data-row="'+tr+'"][data-col="'+tc+'"] .piece');
    if (destSquare) {
        destSquare.classList.remove('landing');
        void destSquare.offsetWidth;
        destSquare.classList.add('landing');
    }

    checkGameEnd();
    if (!gameOver && !promotionPending && gameMode === "computer" && turn === 'Black') {
    setTimeout(computerMove, 500);
}
}

function askPromotion(color) {
    return new Promise(resolve => {
        const pieces = color === 'White'
      ? [['Q','♕'],['R','♖'],['B','♗'],['N','♘']]
      : [['q','♛'],['r','♜'],['b','♝'],['n','♞']];

      promoChoices.innerHTML = '';
      pieces.forEach(([key, glyph]) => {
        const btn = document.createElement('div');
        btn.className = 'promo-piece';
        btn.textContent = glyph;
        btn.addEventListener('click', () => {
            promoteModal.style.display = 'none';
            resolve(key);
        });
        promoChoices.appendChild(btn);
      });

        promoteModal.style.display = 'flex';
    });
}

function checkGameEnd() {
    const inCheck = isInCheck(board, turn);
    const hasMoves = hasAnyLegalMove(board, turn, enPassantTarget, castlingRights);

    if (!hasMoves) {
        gameOver = true;
        if (inCheck) {
            const winner = enemy(turn);
            showGameover('Checkmate', `${cap(winner)} wins`, winner === 'White' ? '♔' : '♚');
        } else {
            showGameover('Stalemate', 'It\'s a draw', '½');
        }
    }
    else if (inCheck) {
        statusMsg.textContent = `${cap(turn)} is in check!`;
    }
}

function showGameover(title, subtitle, icon) {
    gameoverTitle.textContent = title;
    gameoverSub.textContent = subtitle;
    gameoverIcon.textContent = icon;
    gameoverModal.style.display = 'flex';
}

function recordMove(piece, fr, fc, tr, tc, special, capturedPiece, resultingPiece) {
    const files = 'abcdefgh';
    const type = piece.toLowerCase();
    let notation = '';

    if (special === 'castle-k') { notation = 'O-O'; }
    else if (special === 'castle-q') { notation = 'O-O-O'; }
    else {
        if (type !== 'p') notation += piece.toUpperCase();
        else if (capturedPiece) notation += files[fc];
        if (capturedPiece) notation += 'x';
        notation += files[tc] + (8 - tr);
        if (special === 'promo') notation += `=${resultingPiece.toUpperCase()}`;
        if (special === 'enpassant') notation += ' e.p.';
    }

    const nextColor = enemy(turn);
    if (isInCheck(board, nextColor)) {
        if (!hasAnyLegalMove(board, nextColor, enPassantTarget, castlingRights)) {
            notation += '#';
        } else {
            notation += '+';
        }
    }
    moveHistory.push(notation);
}

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

function computerMove() {
    
    if (gameOver || promotionPending) return;

    let allMoves = [];

    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if(piece && isOwn(piece, turn)) {
                const moves = legalMovesFor(board, r, c, turn, enPassantTarget, castlingRights);
                moves.forEach(mv => allMoves.push({ from: {row: r, col: c}, move: mv }));
            }
        }
    if (allMoves.length === 0) return;
    let chosenMove;
    if (aiDifficulty === "Easy") {
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (aiDifficulty === "Medium") {
        allMoves.sort((a, b) => {
            const capA = board[a.move.row][a.move.col] ? 1 : 0;
            const capB = board[b.move.row][b.move.col] ? 1 : 0;
            return capB - capA;
        });
        chosenMove = allMoves[Math.floor(Math.random()* Math.min(5, allMoves.length))];
    } else if (aiDifficulty === "Hard") {
        let bestScore = -Infinity;
        allMoves.forEach(mv => {
            const newBoard = applyMoveToBoard(cloneBoard(board), mv.from.row, mv.from.col, mv.move, turn);
            const score = evaluateBoard(newBoard);
            if (score > bestScore) {
                bestScore = score;
                chosenMove = mv;
            }
        });
    }
        executeMove(chosenMove.from.row, chosenMove.from.col, chosenMove.move);
    // allMoves.sort((a, b) => {
    //     const capA = board[a.move.row][a.move.col] ? 1 : 0;
    //     const capB = board[b.move.row][b.move.col] ? 1 : 0;
    //     return capB - capA;
    // });
    // const randomMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    // executeMove(randomMove.from.row, randomMove.from.col, randomMove.move);
}

function evaluateBoard(b) {
    let score = 0;

    for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++) {
            const piece = b[r][c];
            if (!piece) continue;
            const value = PIECE_VALUES[piece.toLowerCase()];
            if (isWhite(piece)) score -= value;
            else score += value;
        }
    return score;
}

function toggleAIDifficultyButtons(show) {
    [aiEasy, aiMedium, aiHard].forEach(btn => {
        btn.style.display = show ? 'inline-block' : 'none';
        btn.disabled = !show;
        btn.style.opacity = show ? '1' : '0.4';
        });
    }

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
initGame();