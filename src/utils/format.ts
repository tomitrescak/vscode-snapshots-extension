import * as path from 'path';

const html = `<!DOCTYPE html>
<html>

<head>
    <title></title>
</head>

<body style="background: transparent; background-image: none!important">
    <link href='http://fonts.googleapis.com/css?family=Lato:400,700' rel='stylesheet' type='text/css'>
    <link href='https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.13/semantic.min.css' rel='stylesheet' type='text/css'>
		$style
		<div style="background: white">
		$body
		</div>
</body>

</html>`;

export function formatSnapshot(
  ss: any,
  publicPath: string,
  snapshotNames: string[] = null,
  styles = ''
) {
  let bundleStylePath = path.join(publicPath, 'styles', 'bundle.css');
  let luisStylePath = path.join(publicPath, 'styles', 'luis.css');

  let snapshots = '';
  for (let key of Object.getOwnPropertyNames(ss)) {
    // remove snapshots that are not in this test
    if (snapshotNames && snapshotNames.every(s => key.indexOf(s) === -1)) {
      continue;
    }
    let text = ss[key];

    if (text[0] === '{' || text[0] === '[') {
      text = `<pre>${text}</pre>`;
    }
    text = text.replace(/src="(\/|^h)/g, `src="file://${publicPath}/`);
    text = text.replace(
      /image (class="[\w ]+")? *href="\/?/g,
      `image $1 href="file://${publicPath}/`
    );
    text = text.replace(/link href="\/?/g, `link href="file://${publicPath}/`);
    text = text.replace(/: *'?url\("?\/?([\/\w\._]*)"?\)'?/g, `: url('file://${publicPath}/$1')`);
    text = text.replace(/-webkit-\w+,/g, '');
    text = text.replace(/-moz-\w+,/g, '');
    text = text.replace(/-ms-\w+,/g, '');
    snapshots += `
				<div class="ui fluid label">${key.replace(/ 1$/, '')}</div>
				<div class="${ss.cssClassName}" style="padding: 6px">${
      ss.decorator ? ss.decorator.replace('$snapshot', text) : text
    }</div>`;
  }

  // console.log(snapshots);
  let sBody = snapshots.replace(/className/g, 'class');
  sBody = toStyleTag(sBody);
  // handle self closing tags
  sBody = sBody.replace(/<\s*([^\s>]+)([^>]*)\/\s*>/g, '<$1$2></$1>');
  // handle object values
  sBody = sBody.replace(/=\{true\}/g, '');
  sBody = sBody.replace(/=\{false\}/g, '__never');
  sBody = sBody.replace(/=\{([\d\.]*)\}/g, '="$1"');

  let result = html.replace(
    '$body',
    `<div style="padding: 6px">
					${sBody}
			</div>`
  );
  result = result.replace(
    '$style',
    `
				<style type='text/css'>
					${styles}
				</style>
				<link href='file://${luisStylePath}' rel='stylesheet' type='text/css'>
				<link href='file://${bundleStylePath}' rel='stylesheet' type='text/css'>
			`
  );

  return result;
}

let reg = /style=\{\n.*Object (\{[^\}]*\})\n.*\}/g;
function toStyleTag(styleTag) {
  try {
    let g = styleTag.replace(reg, function(m, n) {
      // remove trailing comma
      n = n.replace(/,\n.*\}/, '}');
      let o = JSON.parse(n);

      let values = Object.keys(o).reduce(function(accumulator, currentValue) {
        let m = currentValue.replace(/([A-Z])/g, (v, g) => '-' + g.toLowerCase());
        return accumulator + m + ': ' + o[currentValue] + '; ';
      }, '');
      return `style="${values}"`;
    });
    return g;
  } catch (ex) {
    console.error(ex);
    return styleTag;
  }
}
