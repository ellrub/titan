const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Airtable = require('airtable');
const {nextVoyage} = require("../../utils/constants");
require('dotenv').config();

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user')
        .setDescription('Provides information about you.'),
    async execute(interaction) {
        try {
            // Fetch the user's application from Airtable
            const applications = await base('Applications').select({
                filterByFormula: `{Discord ID} = '${interaction.user.id}'`,
                fields: ['Discord Name', 'Evaluation Status (from Solo Project Link)', 'Email']
            }).firstPage();

            // If no application data is found, return immediately
            if (applications.length === 0) {
                return await interaction.reply({ content: `No additional information found for ${interaction.user.name}.`, ephemeral: true });
            }

            const application = applications[0];
            const applicationData = application.fields;

            // Fetch the user's voyage signups from Airtable
            const voyageSignups = await base('Voyage Signups').select({
                filterByFormula: `AND(OR(Voyage = "V${nextVoyage}",Voyage = "V??"), {Discord ID} = '${interaction.user.id}')`,
                fields: ['Discord Name', 'Email', 'Commitment Form Completed', 'Tier']
            }).firstPage();

            let voyageSignupData = null;
            if (voyageSignups.length > 0) {
                const voyageSignup = voyageSignups[0];
                voyageSignupData = voyageSignup.fields;
            }

            // User signup for next voyage
            const nextVoyageSignupText = voyageSignups.length!==0?
                `Yes (${voyageSignups[0].fields['Tier'].slice(0,6)}) <a:check:1196112072614887534> `:
                'No :x: [Click Here to Signup](https://forms.gle/DajSfXQCX4qbMAu8A)'
            const commitmentFormText = voyageSignups.length===0? 'N/A':
                voyageSignups[0]?.fields['Commitment Form Completed'] === 'Yes'?
                    'Yes <a:check:1196112072614887534>':
                    'No :x: [Fill out Commitment Form](https://forms.gle/p5bhpoKFVBatQhnCA)'

            // Fetch the user's solo project from Airtable
            const soloProjects = await base('Solo Projects').select({
                filterByFormula: `{Discord ID} = '${interaction.user.id}'`,
                fields: ['Discord Name', 'Email', 'Tier', 'GitHub ID']
            }).firstPage();

            let soloProjectData = null;
            let githubId = 'N/A';
            let soloProjectTier = 'N/A';
            if (soloProjects.length > 0) {
                const soloProject = soloProjects[0];
                soloProjectData = soloProject.fields;
                githubId = soloProjectData['GitHub ID'];
                soloProjectTier = `Tier ${soloProjectData['Tier'][5]}`;
            }

            // Check if the Discord name and email match in both tables
            const isDiscordNameMatch = applicationData && voyageSignupData && applicationData['Discord Name'] === voyageSignupData['Discord Name'] ? 'Match <a:check:1196112072614887534>' : (applicationData && voyageSignupData ? 'Mismatch :x:' : 'N/A');
            const isEmailMatch = applicationData && voyageSignupData && applicationData['Email'] === voyageSignupData['Email'] ? 'Match <a:check:1196112072614887534>' : (applicationData && voyageSignupData ? 'Mismatch :x:' : 'N/A');

            // Get the evaluation status
            let evaluationStatus = applicationData['Evaluation Status (from Solo Project Link)'];
                if (Array.isArray(evaluationStatus)) {
                    if (evaluationStatus.includes('Passed')) {
                        evaluationStatus = 'Passed';
                    } else {
                        evaluationStatus = evaluationStatus[evaluationStatus.length - 1];
                    }
                }

                let evaluationEmoji = ':x:';
                if (evaluationStatus && evaluationStatus.toLowerCase() === 'passed') {
                    evaluationEmoji = '<a:check:1196112072614887534>';
                }

            const status = (applicationData['Discord Name'] === interaction.user.username) ? 'OK <a:check:1196112072614887534>' : 'Mismatch :x:';

            // Create an embed message
            const embed = new EmbedBuilder()
                .setColor('#6DE194')
                .setTitle('User Information')
                .setDescription("A check to see that your Discord account matches with your application, and that you've passed the Solo Project. If any of the fields show an :x:, please open a ticket in <#1105911757177888908> to resolve the issue.")
                .addFields(
                    { name: 'Email', value: applicationData && applicationData['Email'] ? `${applicationData['Email']} <a:check:1196112072614887534>` : 'No email found :x:', inline: true },
                    { name: 'Github ID', value: soloProjectData && soloProjectData['GitHub ID'] ? `${soloProjectData['GitHub ID']}` : 'N/A', inline : true},
                    { name: '\u200B', value: '\u200B' },
                    { name: 'Discord account match', value: status ? status : 'N/A', inline: true },
                    { name: 'Evaluation Status', value: evaluationStatus ? `${evaluationStatus} ${evaluationEmoji}` : 'N/A', inline: true },
                    { name: 'Solo Project Tier', value: soloProjectTier, inline : true},
                    { name: '\u200B', value: '\u200B' },
                )
                .addFields(
                    { name: 'Voyage Email Match', value: isEmailMatch ? isEmailMatch : 'N/A', inline: true },
                    { name: 'Voyage Discord Match', value: isDiscordNameMatch ? isDiscordNameMatch : 'N/A', inline: true },
                    { name: '\u200B', value: '\u200B'},
                )
                .addFields(
                    { name: `Signed up for V${nextVoyage}?`, value: nextVoyageSignupText, inline: true},
                    { name: `Commitment Form for V${nextVoyage}?`, value: commitmentFormText, inline: true}
                )
                .setThumbnail('https://imgur.com/EII19bn.png');

            // Reply with the user's information in an embed message
            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'An error occurred while trying to fetch user information.', ephemeral: true });
        }
    },
};