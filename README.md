# Lesson Image Studio

面向高中教研场景的本地浏览器画图工作台。

首版已实现：

- `Owner -> ImageItem -> ImageVersion` 的多图与版本树模型
- `question / asset / other` 三种 Owner 入口
- 空图片项、导入底图、AI 生图、AI 改图
- 同图串行、跨图并发的异步任务中心
- 当前定稿、导出、发布占位、回收站
- 系统模板 + 个人模板
- 固定工作台 UI：左栏、轻顶栏、中画布、右检视器、统一 utility drawer
- 复制为新图片项起点，避免跨图串版本

## 目录

```text
lesson-image-studio/
  backend/   FastAPI + SQLAlchemy + Alembic + uv
  frontend/  React + Vite + TypeScript
  docs/
  data/
```

## 初始化约定

- 仓库根目录已独立 `git init`
- 后端使用 `uv init --package --python 3.13`
- Python 固定 `3.13`

## 本地运行

### 1. 启动后端

```bash
cd backend
uv run alembic upgrade head
uv run uvicorn lesson_image_studio_backend.main:app --reload
```

默认地址：`http://127.0.0.1:8000`

可选环境变量：

```bash
export LESSON_IMAGE_STUDIO_OPENAI_API_KEY=your_key_here
```

如果没有配置 Key：

- 允许创建 AI 任务
- 任务会进入失败态
- 错误信息会明确提示未配置 `OPENAI_API_KEY`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173`

## 测试

后端：

```bash
cd backend
uv run pytest
```

前端：

```bash
cd frontend
npm run test
npm run build
```

## 文档

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [UI_WORKBENCH.md](docs/UI_WORKBENCH.md)
- [AI_HANDOFF.md](docs/AI_HANDOFF.md)
- [TODO.md](docs/TODO.md)
- [DECISIONS.md](docs/DECISIONS.md)
- [NEXT_PHASE_PLAN.md](docs/NEXT_PHASE_PLAN.md)
- [SETTINGS_SPEC.md](docs/SETTINGS_SPEC.md)
