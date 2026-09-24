const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

exports.handler = async function(event, context) {
    // Xử lý preflight CORS request
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    // Chỉ chấp nhận phương thức POST
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: "Method Not Allowed" })
        };
    }

    try {
        let bodyObj = {};
        try {
            bodyObj = JSON.parse(event.body || "{}");
        } catch (e) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: "Dữ liệu gửi lên không đúng định dạng JSON." })
            };
        }

        const { prompt } = bodyObj;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Chưa cấu hình GEMINI_API_KEY trên biến môi trường (Environment Variables) của Netlify." })
            };
        }

        // Danh sách các model đa dạng thuộc nhiều cụm máy chủ khác nhau của Google để triệt tiêu lỗi quá tải (High Demand)
        const models = [
            "gemini-1.5-flash-8b", // Cụm 8B siêu nhẹ, phản hồi cực nhanh, gần như không bao giờ quá tải
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.5-flash",
            "gemini-1.5-pro"
        ];

        // Hàm gọi Google Gemini với cơ chế tự động thử lại (Retry) nhanh khi gặp lỗi High Demand (503/429)
        async function fetchModelWithRetry(model, maxRetries = 1) {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 7000);
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const data = await res.json();
                    if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                        return data.candidates[0].content.parts[0].text;
                    }

                    const errMsg = data.error?.message || `Lỗi HTTP ${res.status}`;
                    // Nếu gặp lỗi quá tải (High demand / 503 / 429) và còn lượt retry
                    if (attempt < maxRetries && (res.status === 503 || res.status === 429 || errMsg.toLowerCase().includes("high demand") || errMsg.toLowerCase().includes("overloaded"))) {
                        await new Promise(r => setTimeout(r, 400)); // Đợi 400ms rồi thử lại
                        continue;
                    }
                    throw new Error(errMsg);
                } catch (err) {
                    clearTimeout(timeoutId);
                    if (attempt < maxRetries && err.name !== "AbortError") {
                        await new Promise(r => setTimeout(r, 300));
                        continue;
                    }
                    throw err;
                }
            }
        }

        // Chạy song song các model đa cụm, lấy phản hồi từ model thành công đầu tiên
        const fetchPromises = models.map(m => fetchModelWithRetry(m));

        try {
            const aiResponse = await Promise.any(fetchPromises);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiResponse })
            };
        } catch (aggregateErr) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Máy chủ Google Gemini đang quá tải cục bộ trong giây lát. Vui lòng bấm gửi lại câu hỏi!" })
            };
        }
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message })
        };
    }
};