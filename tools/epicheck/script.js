let currentScore = 0;

function nextScreen(nextScreenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    // Show target screen
    const target = document.getElementById(nextScreenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
}

function answerQuestion(questionNumber, score) {
    currentScore += score;

    if (questionNumber === 1) {
        nextScreen('screen-q2');
    } else if (questionNumber === 2) {
        nextScreen('screen-q3');
    } else if (questionNumber === 3) {
        calculateResult();
    }
}

function calculateResult() {
    let title = "";
    let message = "";

    if (currentScore >= 100) {
        title = "【空虚な欲望】\n（自然でも必要でもない欲望）";
        message = "エピクロス：おっと、立ち止まって。それは君自身の底から湧き出た願いではなく、社会の目や他人の価値観によって植え付けられた『空虚な欲望』だよ。他人の評価や際限のない富は、いくら追い求めても心が満たされることはない。今の君からその欲望を切り捨ててしまっても、君の幸せは全く揺らがないはずだ。";
    } else if (currentScore >= 10) {
        title = "【自然で必要な欲望】";
        message = "エピクロス:なるほど、それは『自然で必要な欲望』だね。空腹を満たすための質素なパンや、雨風をしのぐための場所、そして信頼できる友人のようなものだ。これを満たすことは、君が心の平穏（アタラクシア）を保つための土台になる。無理に我慢せず、しっかりと満たしてあげなさい。";
    } else if (currentScore === 1) {
        title = "【自然だが不必要な欲望】";
        message = "エピクロス：ふむ、それは『自然だが不必要な欲望』に分類されるね。豪華な食事や、少し贅沢な趣味のようなものだ。決して悪いことではないし、たまに楽しむ分には人生のスパイスになる。だが、それに依存したり、『ないと耐えられない』と思い込んだりしないように気をつけなさい。失っても笑っていられる程度の距離感が大切だよ。";
    } else {
        title = "【幻の欲望】";
        message = "エピクロス:おや？他人の目も気にせず、生きていくのに必須でもなく、かといって感覚的な快楽を高めるわけでもない……。君が思い浮かべたそれは、もはや『欲望』ですらないかもしれないね。単なる気まぐれか、あるいはただの習慣になっていないか、もう一度自分の胸に聞いてみるといい。";
    }

    document.getElementById('result-title').innerText = title;
    document.getElementById('result-message').innerText = message;

    nextScreen('screen-result');

    // Show donation modal after a slight delay
    setTimeout(() => {
        document.getElementById('support-modal').classList.remove('hidden');
    }, 1500);
}

function resetTest() {
    currentScore = 0;
    nextScreen('screen-opening');
}

function shareResult() {
    const title = document.getElementById('result-title').innerText;
    const shareText = `私の欲望は${title}でした。\nEpiCheck - エピクロスの欲望診断\n心をざわつかせる欲望の正体を見極めよう。`;
    const shareUrl = "https://tegrallab.com/tools/epicheck/";

    // Web Share API
    if (navigator.share) {
        navigator.share({
            title: 'EpiCheck - エピクロスの欲望診断',
            text: shareText,
            url: shareUrl,
        })
            .catch(console.error);
    } else {
        // Fallback to X (Twitter)
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twitterUrl, '_blank');
    }
}

function closeModal() {
    document.getElementById('support-modal').classList.add('hidden');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Prevent default form submissions if any exist
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', e => e.preventDefault());
    });
});
