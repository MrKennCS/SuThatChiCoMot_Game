# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tổng quan Dự án (Project Overview)
- **Tên dự án:** Thám tử AI (Detective OS: Interrogation) — "Ai thông minh hơn Conan?".
- **Thể loại:** Trò chơi web trinh thám tương tác tương tự visual novel / detective OS, tích hợp LLM (Google Gemini) để người chơi thẩm vấn nghi phạm trong các vụ án mạng phòng kín / bí ẩn phức tạp.
- **Mục tiêu:** Thám tử điều tra hồ sơ hiện trường, thẩm vấn tối đa 3 lần / nghi phạm (tiêu tốn điểm số), bắt bẻ lỗ hổng logic hoặc thủ thuật gây án và chọn đúng hung thủ tại "Phòng Phán Xét".

---

## Kiến trúc Kỹ thuật (Architecture & Tech Stack)

1. **Frontend:**
   - [index.html](index.html): Giao diện Single Page Application (SPA) gồm 4 màn hình: Main Menu, Loading Screen, Game Board (Detective OS), và Result Modal / Accuse Modal / Settings Modal.
   - **Styling:** Tailwind CSS CDN kết hợp CSS tùy chỉnh, hỗ trợ chuyển đổi 2 theme: Cyberpunk (Dark) & Lavender Tím (Light).
   - [script.js](script.js):
     - **Canvas Particle Trace:** Hiệu ứng ma trận ký tự bay theo con trỏ chuột ở Main Menu.
     - **Web Audio API:** Tạo hiệu ứng âm thanh (SFX) tổng hợp qua `AudioContext` & `OscillatorNode` (không phụ thuộc file âm thanh ngoài).
     - **Game Engine & State Management:** Quản lý điểm (`score`), số lượt hỏi (`attempts`), lịch sử trò chuyện (`chatHistories`), hiển thị gõ chữ (`isTyping`), thông báo toast tin nhắn và logic kết án.

2. **Dữ liệu Vụ án:**
   - [data.json](data.json): Chứa 40 kịch bản vụ án trinh thám kinh điển phong cách Conan. Mỗi kịch bản bao gồm: `case_id`, `title`, `victim`, `context_html` (bối cảnh, timeline, red herrings), `killer_id`, và danh sách `suspects` (`name`, `role`, `psycho` với `trait`/`pronouns`/`behavior`, `initial` lời khai giả, `truth` sự thật/thủ thuật, `is_killer`).

3. **Backend / Serverless:**
   - [netlify/functions/chat.js](netlify/functions/chat.js): Netlify Serverless Function nhận câu hỏi thẩm vấn từ frontend, giữ an toàn biến môi trường `GEMINI_API_KEY`, gọi Google Gemini API và hỗ trợ fallback tuần tự giữa các model (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, ...).
   - [netlify.toml](netlify.toml): Cấu hình publish thư mục gốc và redirect `/api/chat` -> `/.netlify/functions/chat`.

---

## Quy trình Phát triển & Triển khai (Development & Deployment)

- **Chạy Local:**
  - Có thể chạy bằng Live Server (VSCode extension) hoặc bất kỳ static server nào (ví dụ: `npx serve .` hoặc `python -m http.server 8000`).
  - Để test Netlify Functions cục bộ: Sử dụng Netlify CLI (`ntl dev` hoặc `netlify dev`).
- **Deploy:**
  - Kết nối Git repository với Netlify.
  - Cấu hình biến môi trường trên Netlify Dashboard:
    - Key: `GEMINI_API_KEY`
    - Value: `<Google Gemini API Key>`
