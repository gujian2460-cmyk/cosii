# 部署示例文件（复制到服务器使用）

| 文件 | 用途 |
|------|------|
| `env.production.example` | 生产环境变量清单模板，复制为服务器上的 `api.env` 等并填入真实值（**勿提交含密钥的文件**）。 |
| `nginx-cosii-api.conf.example` | Nginx 反代 + 80 端口；配合 Certbot 申请 HTTPS。 |
| `cosii-api.service.example` | systemd 常驻进程示例；按需修改 `WorkingDirectory`、`ExecStart` 路径。 |

**小白按步骤操作：** [docs/tutorials/轨道0-合规步骤02-07小白教程.md](../docs/tutorials/轨道0-合规步骤02-07小白教程.md)

**与执行计划对应：** `docs/designs/autoplan-执行计划与方略要点-2026-04-01.md` 轨道 0 之 0.2、0.5。
