// Coordinates the interaction of elements on the page
(function() {

    var DOM = {};
    DOM.required = $(".required");
    DOM.total = $(".total");
    DOM.secret = $(".secret");
    DOM.distributesize = $(".distributesize");
    DOM.recreatesize = $(".recreatesize");
    DOM.error = $(".error");
    DOM.generated = $(".generated");
    DOM.parts = $(".parts");
    DOM.combined = $(".combined");
    DOM.participants = $(".participants");
    DOM.password = $("#pass");
    DOM.passwordConfirmation = $("#passConfirm");
    DOM.downloadBtn = $("#downloadBtn");
    DOM.passMatchErr = $("#passMatchErr");
    DOM.participantsErr = $("#participantsErr");
    DOM.requiredDisabled = $(".requiredDisabled");
    DOM.ethAddress = $(".ethAddress");

    let participants = [];
    let doPasswordsMatch = true;
    let hasEnoughParticipants = false;
    let finalBlobUrl = undefined;
    let walletAddress = "";

    
    const downloadBlobAsFile = (object_URL, filename) => {
        const a = document.createElement("a");
        a.href = object_URL;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(object_URL);
    };

    const init = () => {
        // Events
        DOM.required.addEventListener("input", generateParts);
        DOM.total.addEventListener("input", generateParts);
        DOM.secret.addEventListener("input", generateParts);
        DOM.parts.addEventListener("input", combineParts);
        DOM.participants.addEventListener("input", readParticipants);
        DOM.password.addEventListener("input", readPassword);
        DOM.passwordConfirmation.addEventListener("input", readPasswordConfirmation);
        DOM.downloadBtn.addEventListener("click", onDownload);

        DOM.downloadBtn.disabled = !doPasswordsMatch || !hasEnoughParticipants;

        let randomWallet = window.ethers.Wallet.createRandom();
        walletAddress = randomWallet.address;
        DOM.ethAddress.value = randomWallet.address;
        const creationDate = new Date().toString();

        DOM.secret.textContent = "\tmnemonic: \n" + randomWallet.mnemonic.phrase + "\n" + "\tprivKey: \n" + randomWallet.privateKey + "\n" + "\taddr: \n" + randomWallet.address + "\n" + "\tcreated: \n" + creationDate
        generateParts()
    }

    const onDownload = () => {
        if (finalBlobUrl && doPasswordsMatch) {
            downloadBlobAsFile(finalBlobUrl, "wallet_" + walletAddress + ".zip"); //TODO: add current date to filename
        }
    }

    const readPassword = () => {
        doPasswordsMatch = (DOM.password.value === DOM.passwordConfirmation.value);
        DOM.downloadBtn.disabled = !doPasswordsMatch || !hasEnoughParticipants;
        DOM.passMatchErr.style.visibility = doPasswordsMatch ? "hidden" : "visible";
        if (doPasswordsMatch) {
            generateParts();
        }
    }

    const readPasswordConfirmation = () => {
        doPasswordsMatch = (DOM.password.value === DOM.passwordConfirmation.value);
        DOM.downloadBtn.disabled = !doPasswordsMatch || !hasEnoughParticipants;
        DOM.passMatchErr.style.visibility = doPasswordsMatch ? "hidden" : "visible";
        if (doPasswordsMatch) {
            generateParts();
        }
    }

    const readParticipants = async () => {
        participants = DOM.participants.value.split(',').map(item => {
            return item.trim().replace(/[/\\?%*:|"<>]/g, '');
          }).filter(el => el !== '');
        DOM.total.value = participants.length;
        DOM.required.max = participants.length;
        DOM.requiredDisabled.max = participants.length;

        if (DOM.required.value < 2) {
            DOM.parts.textContent = "";
            hasEnoughParticipants = false;
            DOM.downloadBtn.disabled = !doPasswordsMatch || !hasEnoughParticipants;
        } else {
            hasEnoughParticipants = true;
            DOM.downloadBtn.disabled = !doPasswordsMatch || !hasEnoughParticipants;
        }
        DOM.participantsErr.style.visibility = hasEnoughParticipants ? "hidden" : "visible";

        if (DOM.required.value > DOM.required.max) {
            DOM.required.value = DOM.required.max;
            DOM.requiredDisabled.value = DOM.requiredDisabled.max;
        } else {
            //Adjust Required to satisfy a particular treshold (51%)
            DOM.required.value = Math.floor(DOM.required.max / 2) + 1;
            DOM.requiredDisabled.value = DOM.required.value;
        }
        generateParts();
    }

    const generateParts = async () => {
        // Clear old generated
        finalBlobUrl = undefined;
        DOM.generated.innerHTML = "";
        // Get the input values
        var secret = DOM.secret.value;
        var secretHex = secrets.str2hex(secret);
        var total = parseFloat(DOM.total.value);
        var required = parseFloat(DOM.required.value);
        // validate the input
        if (total < 2) {
            DOM.error.textContent = "Total must be at least 1";
            return;
        }
        else if (total > 255) {
            DOM.error.textContent = "Total must be at most 255";
            return;
        }
        else if (required < 2) {
            DOM.error.textContent = "Required must be at least 1";
            return;
        }
        else if (required > 255) {
            DOM.error.textContent = "Required must be at most 255";
            return;
        }
        else if (isNaN(total)) {
            DOM.error.textContent = "Invalid value for total";
            return;
        }
        else if (isNaN(required)) {
            DOM.error.textContent = "Invalid value for required";
            return;
        }
        else if (required > total) {
            DOM.error.textContent = "Required must be less than total";
            return;
        }
        else if (secret.length == 0) {
            DOM.error.textContent = "Secret is blank";
            return;
        }
        else {
            DOM.error.textContent = "";
        }
        // Generate the parts to share
        var minPad = 1024; // see https://github.com/amper5and/secrets.js#note-on-security
        var shares = secrets.share(secretHex, total, required, minPad);
        const ethAddrShort = walletAddress.substring(0,8);

        // Create zip writer
        const model = (() => {
            let zipWriter;
            return {
                addFile(file, options) {
                    if (!zipWriter) {
                        zipWriter = new zip.ZipWriter(new zip.BlobWriter("application/zip"), { bufferedWrite: true });
                    }
                    return zipWriter.add(file.name, new zip.BlobReader(file), options);
                },
                async getBlobURL(file) {
                    if (zipWriter) {
                        const blobURL = URL.createObjectURL(file);
                        return blobURL;
                    } else {
                        throw new Error("Zip file closed");
                    }
                },
                async getBlob() {
                    if (zipWriter) {
                        return await zipWriter.close();
                    } else {
                        throw new Error("Zip file closed");
                    }
                }
            };
    
        })();

        //TODO: Put the secret in a text file, designated for treasurer
        var secretBlob = new Blob([DOM.secret.value], {
            type: "plain/text"
        });
        secretBlob.name = ethAddrShort + "_SECRET_requires_" + shares.length + "_of_" + shares.length + "_Treasurer" + ".txt";
        try {
            model.addFile(secretBlob,
                {
                    password: doPasswordsMatch ? DOM.password.value : ""
                });
        } catch (error) {
            console.error(error);
        }

        // Display the parts
        for (var i=0; i<shares.length; i++) {
            var share = shares[i];
            var li = document.createElement("li");
            li.classList.add("part");
            li.textContent = share;
            DOM.generated.appendChild(li);

            //TODO: Put the part in a text file, designated for a particular person
            var shareBlob = new Blob([share], {
                type: "plain/text"
            });
            shareBlob.name = ethAddrShort + "_share_" + (i+1) + "_of_" + shares.length + "_" + participants[i] + ".txt";
    
            try {
                model.addFile(shareBlob,
                    {
                        password: doPasswordsMatch ? DOM.password.value : ""
                    });
            } catch (error) {
                console.error(error);
            }
        }

        // Update the plain-language info
        DOM.distributesize.textContent = total;
        DOM.recreatesize.textContent = required;

        // Read back the zip file to confirm it's validity
        const readModel = (() => {

            return {
                getEntries(file, options) {
                    return (new zip.ZipReader(new zip.BlobReader(file), {
                        password: doPasswordsMatch ? DOM.password.value : ""
                    })).getEntries(options);
                },
                async getURL(entry, options) {
                    return URL.createObjectURL(await entry.getData(new zip.BlobWriter(), options));
                },
                async getData(entry, options) {
                    return await entry.getData(new zip.BlobWriter(), options);
                }
            };
    
        })();

        // Try to iterate over the share files and reconstruct the share
        const zipFile = await model.getBlob();
        entries = await readModel.getEntries(zipFile, {
            filenameEncoding: "utf-8"
        });
        if (entries && entries.length) {
            DOM.parts.textContent = "";
            entries.map(async file => {
                if (file.filename.startsWith(ethAddrShort + "_share_")) {
                    const fileBlob = await readModel.getData(file, {
                        filenameEncoding: "utf-8"
                    });
                    const fileData = await fileBlob.text();

                    DOM.parts.textContent = DOM.parts.value + fileData + "\n";
                    await combineParts();


                    // Download the entire zip with pk and shares, if reconstructed secret matches the original
                    if (DOM.combined.textContent === DOM.secret.value) {
                        try {
                            finalBlobUrl = await model.getBlobURL(zipFile);
                        }
                        catch (error) {
                            console.error(error);
                        }
                    }
                }
            });
        }

    }

    const combineParts = async () => {
        // Clear old text
        DOM.combined.textContent = "";
        // Get the parts entered by the user
        var partsStr = DOM.parts.value;
        // Validate and sanitize the input
        var parts = partsStr.trim().split(/\s+/);
        // Combine the parts
        try {
            var combinedHex = secrets.combine(parts);
            var combined = secrets.hex2str(combinedHex);
        }
        catch (e) {
            DOM.combined.textContent = e.message;
        }
        // Display the combined parts
        DOM.combined.textContent = combined;
    }

    init();

})();
