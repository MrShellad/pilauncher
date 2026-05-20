import React from 'react';

export const EulaEn: React.FC<{ currentDate: string }> = ({ currentDate }) => {
  return (
    <>
      <h1 className="text-lg text-white border-b border-[#2a2f3a] pb-2 mb-2 font-bold">PiLauncher End User License Agreement & Privacy Policy</h1>
      <p className="mb-4">Last Updated: {currentDate}</p>

      <div className="bg-[#1a1f2b] p-3 rounded-md border border-[#2a2f3a] mb-5 text-white">
        By using this software, you signify that you have read and agreed to all the terms in this agreement.
      </div>

      <div className="mt-8">
        <h2 className="text-base text-white border-l-4 border-[#4da3ff] pl-2 mb-3 font-bold">Part 1: License Agreement</h2>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">1. Software Nature</h3>
        <p className="my-1">PiLauncher is a third-party launcher tool for managing and launching Minecraft.</p>
        <p className="my-1">This software has no affiliation or official relationship with Microsoft or Mojang Studios.</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. Prerequisites</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>You must own a legally purchased genuine Minecraft account.</li>
          <li>Login must be done via the official authentication service.</li>
          <li>Bypassing verification or using pirated copies is strictly prohibited.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">3. Accounts & Authentication</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Login is completed through the official system.</li>
          <li>This software does not store your account password.</li>
          <li>Users are responsible for the security of their own accounts.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">4. Resources & Copyright</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>All resources are sourced from official platforms or your local machine.</li>
          <li>This software does not distribute copyrighted materials.</li>
          <li>Illegal distribution of game resources is prohibited.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">5. Third-Party Services</h3>
        <p className="my-1">This software may integrate third-party services like Mod platforms, subject to their respective terms.</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">6. Paid Services</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Cloud Sync</li>
          <li>Multi-device Management</li>
          <li>Premium Features</li>
        </ul>
        <p className="my-1 font-bold text-[#4da3ff]">All payments are exclusively for launcher features and do not involve the base game.</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">7. Disclaimer</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Provided "as is" without warranty.</li>
          <li>No guarantee of error-free operation or continuous availability.</li>
          <li>We are not liable for data loss or account bans.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">8. Termination</h3>
        <p className="my-1">If the terms are violated, we reserve the right to restrict or terminate the service.</p>
      </div>

      <div className="mt-8">
        <h2 className="text-base text-white border-l-4 border-[#4da3ff] pl-2 mb-3 font-bold">Part 2: Privacy Policy</h2>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">1. Information We Collect</h3>

        <p className="mt-2 font-bold text-[#4da3ff]">(1) Installation Telemetry</p>
        <p className="my-1">
          Installation telemetry is enabled by default. You can disable it at any time in "Settings - Data - Privacy & Telemetry". When enabled, PiLauncher uploads the following data at most once every 3 days:
        </p>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>installationId: Randomly generated client ID</li>
          <li>platform: OS platform (e.g., Windows, macOS, Linux)</li>
          <li>memoryBytes: Total device memory</li>
          <li>gpu: Graphics card name</li>
          <li>appVersion: PiLauncher version</li>
          <li>firstInstalledAt: The time when the installation ID was first generated</li>
        </ul>
        <p className="my-1">
          Telemetry will NEVER upload Minecraft accounts, usernames, access tokens, game saves, log contents, local directory paths, or any credentials that can log into your account.
        </p>

        <p className="mt-2 font-bold text-[#4da3ff]">(2) User-Initiated Data Uploads</p>
        <p className="my-1">
          When you actively use features like remote logs or diagnostics sharing, related content will be uploaded as described by the feature; this is not part of installation telemetry.
        </p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">2. How We Use Information</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Telemetry is only used to analyze installation numbers.</li>
          <li>Used for compatibility testing across different platforms, memory, and GPU environments.</li>
          <li>Will NOT be used for advertising profiles, account tracking, or sold to third parties.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">3. Data Processing Principles</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Do not collect sensitive information.</li>
          <li>Do not store account passwords.</li>
          <li>Anonymize data as much as possible.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">4. Information Sharing</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>When required by law.</li>
          <li>When necessary to provide services.</li>
          <li>Under user authorization.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">5. Data Security</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>Encrypted transmission.</li>
          <li>Reasonable security measures to protect data.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">6. User Rights</h3>
        <ul className="list-disc pl-5 my-1 space-y-1">
          <li>View or delete data.</li>
          <li>Disable installation telemetry upload in settings.</li>
          <li>Withdraw authorization.</li>
        </ul>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">7. Minor Protection</h3>
        <p className="my-1">Minors must use the software with guardian consent.</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">8. Policy Updates</h3>
        <p className="my-1">This policy may be updated, and changes will be notified within the software.</p>

        <h3 className="text-sm text-white mt-4 mb-1 font-bold">9. Contact</h3>
        <p className="my-1">Email: admail1024@gmail.com</p>
      </div>

      <div className="mt-10 mb-2 border-t border-[#2a2f3a] pt-4 text-[0.7rem] text-[#888] text-center">
        PiLauncher © 2026 — This software is provided as a tool only, please support genuine games.
      </div>
    </>
  );
};
