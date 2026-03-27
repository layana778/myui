# 🛡️ 资产风控系统 (Asset Risk Control System)

企业级“库房实物移交与台账管理平台”。基于 React 18 + Vite + TypeScript 构建。

## 🎯 业务背景与核心理念

在两家公司合并后，面临“账实分离”的业务痛点：我方只管账（Ledger），对方管实物（Warehouse）。因此，这不仅是一个普通的资产管理系统，更是一个**“弱控制环境下的资产风控防御系统”**。

系统的核心运作原则：
- **认单不认人**：人员操作只是凭证的附庸，系统流转唯一合法依据是审核单号（Voucher）。
- **流水驱动状态**：资产主档（Asset）状态是底层流水记录（AssetLog）聚合算出的投影视图，前端拒绝任何直接修改状态的 API 接口调用。
- **无凭证不入账**：未携带凭证单据的外部接口脏数据不仅无法修改台账库，还会被弹入**异常池**。

## 👨‍💻 角色与权限隔离 (物理级)

系统通过前端路由守卫（AuthGuard）及微前端打包策略，实施绝对的横向隔离：

1. **🏢 对方库管 (Role_Warehouse)**
   - **权限要求**：只能提报操作，受限于所辖范围，无权查看全局账本及风控预警池。
   - **功能模块**：
     - `资产异动提报单`：动态表单，防抖拉取实景挂载关系，防重提交，单据强阻断。
     - `我发起的提报记录`：只能看自己。

2. **🏦 我方台账负责人 (Role_LedgerAdmin)**
   - **权限要求**：拥有“全局视角上帝视角”，但为了合规防篡改，对主库“只读”，只负责审计和结算法律快照。
   - **功能模块**：
     - `资产大盘`：核心台账数据的全览。
     - `全局流水溯源`：根据 SN 穿透回溯生命周期全时间线。
     - `🚨 红黄灯风控台`：规则引擎抓取“一码多机”、“无单据异动”、“非法配件拆卸”等严重异常冲突（红灯），并支持一键下发质询。
     - `月度对账快照`：每月执行强制封账保存，固化资产 Hash 数据生成电子铁证。

## 🛠️ 技术栈清单

- **框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **类型系统**: [TypeScript](https://www.typescriptlang.org/)
- **UI 库**: [Ant Design (antd)](https://ant.design/)
- **状态树**: [Zustand](https://github.com/pmndrs/zustand)
- **路由系统**: [React Router v6](https://reactrouter.com/)
- **时间处理**: [Day.js](https://day.js.org/)
- **工具库**: [Lodash](https://lodash.com/)

## 🚀 快速启动指引

### 环境要求
- Node.js >= 18
- npm 或 yarn 或 pnpm

### 本地开发

```bash
# 1. 安装项目依赖
npm install

# 2. 启动本地开发服务器
npm run dev
```
打开浏览器访问 [http://localhost:5173/](http://localhost:5173/)。

### 开发指南
项目的重点代码约定位于 `src/core` 目录下：
- **风控数据结构定义**：请参阅 `src/core/types/index.ts`（包含核心注释说明）。
- **路由物理分区**：在 `src/router/index.tsx` 中分块加载打包配置。

## 📦 生产环境构建

```bash
# 检查 TS 编译错误并生成 dist 目录
npm run build

# 在本地预览生产环境构建产物
npm run preview
```
