// Vercel serverless function: /api/check
// Keeps the Anthropic API key on the server (never exposed to the browser).
// The front-end posts { en, ar, userInput } and gets back { correct: boolean }.

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not configured. Add it in your Vercel project's Settings -> Environment Variables, then redeploy.",
    });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { en, ar, userInput } = body || {};
  if (!en || !ar || typeof userInput !== "string") {
    res.status(400).json({ error: "Missing required fields: en, ar, userInput" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 20,
        system:
          'أنت مقيّم ترجمة متساهل جداً وذكي، هدفك تشجيع المتعلم لا معاقبته على تفاصيل شكلية. احكم بـ true إذا كانت إجابة المستخدم تدل بأي شكل معقول على معنى الكلمة الإنجليزية، حتى لو لم تطابق المعنى المرجعي حرفياً. اتبع هذه القواعد بمرونة:\n' +
          '1) تجاهل التشكيل تماماً (فتحة، ضمة، كسرة، سكون، شدة، تنوين).\n' +
          '2) تجاهل الأخطاء الإملائية الشائعة وأخطاء الكتابة السريعة: ى/ي، ة/ه، أ/إ/آ/ا، حرف زائد أو ناقص أو مبدّل، ترتيب حروف مقلوب بسيط، حتى لو كانت الكلمة غير مضبوطة إملائياً طالما يمكن تمييزها.\n' +
          '3) اقبل جميع الصيغ الصرفية القريبة لنفس الجذر أو المعنى: فعل/مصدر/اسم فاعل/اسم مفعول، مذكر/مؤنث، مفرد/جمع، معرفة/نكرة.\n' +
          '4) اقبل المرادفات وأي كلمة أو تعبير عربي آخر يحمل نفس المعنى الأساسي أو معنى قريب منه جداً، حتى لو لم يكن من ضمن المعنى المرجعي المعطى.\n' +
          '5) اقبل الشرح أو التوضيح بجملة كاملة بدل كلمة واحدة، إذا كان الشرح يدل بوضوح على فهم المستخدم لمعنى الكلمة.\n' +
          '6) اقبل المعنى الجزئي أو القريب: إذا كانت إجابة المستخدم تلامس جزءاً معقولاً (تقريباً ٣٠٪ أو أكثر) من المعنى الأساسي، فاعتبرها صحيحة.\n' +
          '7) ارفض فقط إذا كانت الإجابة فارغة، عشوائية تماماً، أو تدل بوضوح على معنى مختلف تماماً لا علاقة له بالكلمة إطلاقاً.\n' +
          'عند الشك، رجّح القبول (true) لا الرفض. أجب حصراً بصيغة JSON دون أي نص أو markdown إضافي، بالشكل التالي بالضبط: {"correct": true} أو {"correct": false}',
        messages: [
          {
            role: "user",
            content: `الكلمة الإنجليزية: "${en}"\nالمعنى المرجعي الصحيح: "${ar}"\nإجابة المستخدم: "${userInput}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(502).json({ error: "Anthropic API error", detail: errText.slice(0, 500) });
      return;
    }

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    res.status(200).json({ correct: parsed.correct === true });
  } catch (err) {
    res.status(500).json({ error: "Server error", detail: String(err && err.message) });
  }
};
