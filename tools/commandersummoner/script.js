// DOM要素の取得
const summonBtn = document.getElementById('summonBtn');
const cardContainer = document.getElementById('cardContainer');
const cardImage = document.getElementById('cardImage');
const cardName = document.getElementById('cardName');
const cardType = document.getElementById('cardType');
const cardInfo = document.getElementById('cardInfo');
const messageBox = document.getElementById('messageBox');
const arena = document.querySelector('.arena');

const filterToggleBtn = document.getElementById('filterToggleBtn');
const filterContent = document.getElementById('filterContent');

const colorCheckboxes = document.querySelectorAll('input[name="color"]');
const colorlessCheckbox = document.getElementById('color-c');

// アコーディオンの開閉処理
filterToggleBtn.addEventListener('click', () => {
    filterContent.classList.toggle('open');
    if (filterContent.classList.contains('open')) {
        filterToggleBtn.innerHTML = '条件を隠す ▲';
        // スクロールして条件を見やすくする
        setTimeout(() => {
            filterToggleBtn.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } else {
        filterToggleBtn.innerHTML = '条件を指定する ▼';
    }
});

// 無色と有色のチェックボックスの排他制御
colorCheckboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
        if (e.target.value === 'c' && e.target.checked) {
            // 無色がチェックされたら、他の有色のチェックを外す
            colorCheckboxes.forEach(otherCb => {
                if (otherCb.value !== 'c') otherCb.checked = false;
            });
        } else if (e.target.checked) {
            // 有色がチェックされたら、無色のチェックを外す
            colorlessCheckbox.checked = false;
        }
    });
});

// 召喚ボタンの処理
summonBtn.addEventListener('click', async () => {
    // UIのリセットとローディング開始
    summonBtn.disabled = true;
    summonBtn.textContent = '詠唱中...';
    messageBox.textContent = '';
    
    // カードを裏面に戻し、情報パネルを隠す
    cardContainer.classList.remove('is-flipped', 'flash-effect');
    cardInfo.classList.remove('show');
    
    // ページ上部（カード位置）にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // 召喚アニメーション開始
    arena.classList.add('is-summoning');
    cardContainer.classList.add('is-summoning');

    // 選択された色を取得
    const checkedColors = document.querySelectorAll('input[name="color"]:checked');
    let colors = [];
    let isColorless = false;

    checkedColors.forEach(cb => {
        if (cb.value === 'c') {
            isColorless = true;
        } else {
            colors.push(cb.value);
        }
    });

    // 選択されたマナコストを取得
    const mana = document.querySelector('input[name="mana"]:checked').value;

    // Scryfall API クエリの構築
    let query = 'is:commander';
    
    // 色指定のクエリ追加 (id= は Color Identity の完全一致指定)
    if (colors.length > 0) {
        query += ` id=${colors.join('')}`;
    } else if (isColorless) {
        query += ` id=c`;
    }
    
    // マナコストのクエリ追加
    if (mana !== 'all') {
        query += ` cmc${mana}`;
    }

    try {
        // 1. 日本語版を優先検索
        let url = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(query + ' lang:ja')}`;
        let response = await fetch(url);

        // 2. 日本語版がなければ言語指定なしで再検索
        if (!response.ok && response.status === 404) {
            url = `https://api.scryfall.com/cards/random?q=${encodeURIComponent(query)}`;
            response = await fetch(url);
        }

        if (!response.ok) {
            throw new Error('条件に合う統率者が見つかりませんでした。別の条件をお試しください。');
        }

        const card = await response.json();
        
        // 画像URLの取得
        let imgUrl = '';
        if (card.image_uris && card.image_uris.normal) {
            imgUrl = card.image_uris.normal;
        } else if (card.card_faces && card.card_faces[0].image_uris) {
            imgUrl = card.card_faces[0].image_uris.normal;
        } else {
            throw new Error('画像データが取得できませんでした。');
        }

        const img = new Image();
        img.src = imgUrl;
        
        // 演出のため画像の読み込みと最低1.5秒待機
        await Promise.all([
            new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
            }),
            new Promise(resolve => setTimeout(resolve, 1500))
        ]);

        // データセット
        cardImage.src = imgUrl;
        const displayName = card.printed_name ? card.printed_name : card.name;
        const subName = card.printed_name ? ` (${card.name})` : '';
        cardName.textContent = displayName + subName;
        cardType.textContent = card.printed_type_line ? card.printed_type_line : card.type_line;

        // 召喚アニメーションを終了し、フリップする
        arena.classList.remove('is-summoning');
        cardContainer.classList.remove('is-summoning');
        cardContainer.classList.add('is-flipped');
        
        // フリップ後にフラッシュエフェクト
        setTimeout(() => {
            cardContainer.classList.add('flash-effect');
            cardInfo.classList.add('show');
        }, 400);

    } catch (error) {
        console.error(error);
        arena.classList.remove('is-summoning');
        cardContainer.classList.remove('is-summoning');
        messageBox.textContent = error.message;
    } finally {
        summonBtn.disabled = false;
        summonBtn.textContent = '召喚 (Summon)';
    }
});
