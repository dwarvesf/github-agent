import { ChatInputCommandInteraction, PermissionsString } from 'discord.js'

import { AskCommandName } from '../../enums/index.js'
import { EventData } from '../../models/internal-models.js'
import { Language } from '../../models/enum-helpers/index.js'
import { Lang } from '../../services/index.js'
import { InteractionUtils } from '../../utils/index.js'
import { Command, CommandDeferType } from '../index.js'

export class AskCommand implements Command {
    public names = [Lang.getRef('chatCommands.ask', Language.Default)]
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = []
    public async execute(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        let args = {
            command: intr.options.getString(
                Lang.getRef('arguments.command', Language.Default)
            ) as AskCommandName,
            prompt: intr.options.getString(
                Lang.getRef('arguments.promptText', Language.Default)
            )
        }

        if (args.prompt) {
            await this.handlePrompt(intr, data)
            return
        }

        switch (args.command) {
            case AskCommandName.HELP: {
                await this.displayHelp(intr, data)
                break
            }
            default: {
                await InteractionUtils.send(
                    intr,
                    Lang.getEmbed('errorEmbeds.invalidSubcommand', data.lang)
                )
                return
            }
        }
    }

    private async displayHelp(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        await InteractionUtils.send(
            intr,
            Lang.getEmbed('displayEmbeds.askHelp', data.lang, {
                PREFIX: '/',
                COMMAND: this.names[0],
            })
        )
    }

    private async handlePrompt(intr: ChatInputCommandInteraction, data: EventData): Promise<void> {
        // Get the full message content after the command
        const question = intr.toString().replace("/ask prompt:", "")

        if (!question) {
            await InteractionUtils.send(
                intr,
                Lang.getEmbed('errorEmbeds.missingPrompt', data.lang)
            )
            return
        }

        // Start with an empty response message
        await InteractionUtils.send(
            intr,
            Lang.getEmbed('displayEmbeds.askResponse', data.lang, {
                QUESTION: question,
                RESPONSE: '...',
                USER: intr.user.id,
            })
        )

        let response = ''
        for await (const chunk of getStreamedResponse(question)) {
            response += chunk
            await InteractionUtils.editReply(
                intr,
                Lang.getEmbed('displayEmbeds.askResponse', data.lang, {
                    QUESTION: question,
                    RESPONSE: response,
                    USER: intr.user.id,
                }),
            )
        }
    }
}

// Mock function to simulate a streaming response
async function* getStreamedResponse(input: string) {
    const parts = [
        'This is the first part of the response... ',
        'and this is the second part... ',
        'finally, the last part!'
    ]
    for (const part of parts) {
        yield part
        await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate delay
    }
}