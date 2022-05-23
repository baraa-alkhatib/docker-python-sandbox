# import modules
from os import path, getcwd
from glob import glob
from pdf2image import convert_from_path

def find_ext(dr, ext_list):
    path_list = []

    for ext in ext_list:
        loc_path_list = glob(path.join(dr,"*.{}".format(ext)))

        print(path.join(dr,"*.{}".format(ext)))

        path_list += loc_path_list

    return path_list


path_list = find_ext(path.join(path.dirname(path.realpath(__file__)), "..", "uploads"), ["pdf"])

print(''.join(path_list))

for p in path_list:
    # Store Pdf with convert_from_path function
    images = convert_from_path(p)

    print(images)

    for i in range(len(images)):
        image_path = path.join(path.join(path.dirname(path.realpath(__file__)), "..", "images"), path.splitext(path.basename(p))[0] + '-slide-' + str(i) + '.jpg')
        
        # Save pages as images in the pdf
        images[i].save(image_path, 'JPEG')