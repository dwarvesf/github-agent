import {
    Interaction,
    ModalSubmitInteraction,
    GuildMember,
} from 'discord.js';

import { EventHandler } from './event-handler.js';
import { InteractionUtils } from '../utils/index.js';
import { Logger } from '../services/index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Logs = require('../../lang/logs.json');

export class ModalHandler implements EventHandler {
    public async process(interaction: Interaction): Promise<void> {
        // Don't handle incomplete or non-guild interactions
        if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
            return;
        }

        if (interaction.isModalSubmit()) {
            await this.handleModalSubmit(interaction);
            return;
        }
    }

    private async handleModalSubmit(
        interaction: ModalSubmitInteraction,
    ): Promise<void> {
        try {
            Logger.info(interaction.customId)

            // Handle access key modal
            if (interaction.customId.startsWith('access-key-modal')) {
                await this.handleAccessKeyModal(interaction);
                return;
            }

            // Handle other modals here if needed
        } catch (error) {
            Logger.error(Logs.error.unspecified, error);
            
            if (!interaction.replied && !interaction.deferred) {
                await InteractionUtils.send(interaction, {
                    content: 'Something went wrong when processing your submission. Please try again.',
                    ephemeral: true,
                });
            }
        }
    }

    private async handleAccessKeyModal(
        interaction: ModalSubmitInteraction,
    ): Promise<void> {
        try {
            // Get the key from the submission
            const submittedKey = interaction.fields.getTextInputValue('access-key-input');

            Logger.info(`Access key submitted: ${submittedKey}`);
            
            // Check if the key is valid (replace this with your actual validation)
            const validKey = 'secret123'; // In a real scenario, this would be stored securely
            
            if (submittedKey === validKey) {
                // Get the private role
                const privateRole = interaction.guild?.roles.cache.find(role => role.name === 'PrivateAccess');
                
                if (privateRole) {
                    // Grant the role
                    const member = interaction.member as GuildMember;
                    await member.roles.add(privateRole);
                    
                    // Respond to the user
                    await interaction.reply({
                        content: '✅ **Access Granted!** You now have access to the private channels.',
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Configuration error: Private role not found. Please contact an administrator.',
                        ephemeral: true
                    });
                }
            } else {
                // Invalid key
                await interaction.reply({
                    content: '❌ **Invalid key!** The access key you provided is not correct. Please try again or contact an administrator.',
                    ephemeral: true
                });
            }
        } catch (error) {
            Logger.error(Logs.error.unspecified, error);
            
            // Only reply if we haven't already
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred while processing your access key. Please try again.',
                    ephemeral: true
                });
            }
        }
    }
}