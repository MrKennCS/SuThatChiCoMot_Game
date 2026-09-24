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

        // 1. Danh sách các model ứng viên phổ biến nhất
        let candidateModels = [
            "gemini-1.5-flash-latest",
            "gemini-1.5-flash",
            "gemini-2.0-flash-exp",
            "gemini-pro",
            "gemini-2.0-flash"
        ];

        let aiResponse = "";
        let success = false;
        let lastError = "";

        // Hàm thử gọi generateContent với 1 model cụ thể
        async function callGemini(modelName) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const data = await res.json();
                if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return { success: true, reply: data.candidates[0].content.parts[0].text };
                } else {
                    return { success: false, status: res.status, error: data.error?.message || `Lỗi từ ${modelName}` };
                }
            } catch (err) {
                clearTimeout(timeoutId);
                return { success: false, error: err.message };
            }
        }

        // Thử nhanh các model ứng viên đầu tiên
        for (const model of candidateModels) {
            const result = await callGemini(model);
            if (result.success) {
                aiResponse = result.reply;
                success = true;
                break;
            } else {
                lastError = result.error;
                // Nếu sai API key (400, 403) thì dừng ngay
                if (result.status === 400 || result.status === 403 || lastError.toLowerCase().includes("api key")) {
                    break;
                }
            }
        }

        // 2. Nếu các model mặc định không khớp, tự động hỏi API của Google để lấy đúng danh sách model hỗ trợ cho API Key này
        if (!success && !lastError.toLowerCase().includes("api key")) {
            try {
                const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                const listData = await listRes.json();
                if (listRes.ok && listData.models && Array.isArray(listData.models)) {
                    const supportedModels = listData.models
                        .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                        .map(m => m.name.replace(/^models\//, ""));

                    // Ưu tiên flash -> pro -> bất kỳ model nào còn lại
                    const sorted = supportedModels.sort((a, b) => {
                        if (a.includes("flash") && !b.includes("flash")) return -1;
                        if (!a.includes("flash") && b.includes("flash")) return 1;
                        return 0;
                    });

                    for (const autoModel of sorted) {
                        if (!candidateModels.includes(autoModel)) {
                            const result = await callGemini(autoModel);
                            if (result.success) {
                                aiResponse = result.reply;
                                success = true;
                                break;
                            } else {
                                lastError = result.error;
                            }
                        }
                    }
                }
            } catch (listErr) {
                // Giữ lại lastError trước đó
            }
        }

        if (success) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: aiResponse })
            };
        } else {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: lastError })
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