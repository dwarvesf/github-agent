import { Request, Response, Router } from 'express'
import router from 'express-promise-router'

import { Controller } from './index.js'

export class RootController implements Controller {
  public path = '/'
  public router: Router = router()

  public register(): void {
    this.router.get('/', (req, res) => this.get(req, res))
    this.router.get('/healthz', (req, res) => this.health(req, res))
  }

  private async health(req: Request, res: Response): Promise<void> {
    res.status(200).json({ status: 'ok' })
  }

  private async get(req: Request, res: Response): Promise<void> {
    res
      .status(200)
      .json({ name: 'Discord Bot Cluster API', author: 'Kevin Novak' })
  }
}
