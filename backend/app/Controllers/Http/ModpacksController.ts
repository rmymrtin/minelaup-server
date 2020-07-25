import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import User from 'App/Models/User'
import { schema, rules } from '@ioc:Adonis/Core/Validator'
import Modpack from 'App/Models/Modpack'
import Team from 'App/Models/Team'
import TeamUser from 'App/Models/TeamUser'
import TeamRole from 'App/Models/TeamRole'

export default class ModpacksController {
  /**
   * list modpacks function
   */
  public async getList ({ auth, response }: HttpContextContract) {
    // Get the current user teams
    const user = await User
      .query()
      .preload('teams', (query) => {
        query.preload('modpacks')
        query.select('id', 'name')
      })
      .where('id', auth.user!.id)
      .firstOrFail()

    return response.json(user.teams)
  }

  /**
   * Get a modpack
   */
  public async get ({ auth, response, request}: HttpContextContract) {
    const data = await request.validate({
      schema: schema.create({
        id: schema.number([
          rules.unsigned(),
          rules.exists({
            column: 'id',
            table: 'modpacks',
          }),
        ]),
      }),
    })

    // Get the modpack
    const modpack = await Modpack.findOrFail(data.id)

    // Check if the user has the right to get the modpack
    const teamUser = await TeamUser
      .query()
      .preload('teamRole', (query: TeamRole) => {
        query.preload('permission')
      })
      .preload('team', (query: Team) => {
        query.preload('defaultPermission')
      })
      .where('user_id', auth.user!.id)
      .andWhere('team_id', modpack.teamId)
      .firstOrFail()

    let userPerms: any = null

    // Is the user is the owner
    if (teamUser.team.ownerId === auth.user!.id) {
      // Set the permissions
      userPerms = {
        owner: true,
      }
    // Is the user have a role
    } else if (teamUser.teamRoleId) {
      // Set the permissions
      userPerms = teamUser.teamRole.permission
    } else {
      userPerms = teamUser.team.defaultPermission
    }

    // Send the team information and permissions
    response.send({
      ...modpack.toJSON(),
      team: teamUser.team.toJSON(),
      userPerms,
    })
  }

  /**
   * Create team function
   */
  public async create ({ request, response }: HttpContextContract) {
    // Validate datas
    const data = await request.validate({
      schema: schema.create({
        // The name has to be an unique string of maximum 50 characters
        name: schema.string({}, [
          rules.unique({
            column: 'name',
            table: 'modpacks',
          }),
          rules.maxLength(45),
        ]),
        summary: schema.string.optional({}, [
          rules.maxLength(2048),
        ]),
        team_id: schema.number([
          rules.exists({
            column: 'id',
            table: 'teams',
          }),
        ]),
      }),
      cacheKey: request.url(),
    })

    // Create a modpack
    const modpack = await Modpack.create({
      name: data.name,
      summary: data.summary,
      teamId: data.team_id,
    })
    // Send back the modpack informations
    return response.send(modpack)
  }
}
